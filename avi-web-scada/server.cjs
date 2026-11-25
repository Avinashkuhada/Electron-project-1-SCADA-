const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const net = require('net');
const { sql, getPool, getDataPool } = require('./db.cjs');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// 0. ROOT TEST ROUTE
app.get('/', (req, res) => {
  res.send('✅ AVI_IRS_UM & AVI_IRS_DATA Backend API is Running on Port 5000!');
});

// 1. CONNECTION TRACKER ENDPOINT
app.get('/api/health', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT DB_NAME() AS dbName, @@SERVERNAME AS serverName');
    const info = result.recordset.at(0);
    res.json({
      serverConnected: true,
      dbConnected: true,
      message: `Connected to ${info.serverName} (Database: ${info.dbName})`
    });
  } catch (err) {
    res.status(500).json({
      serverConnected: true,
      dbConnected: false,
      message: `Server OK, but SQL Failed: ${err.message}`
    });
  }
});

// 2. GET all management data + EmployeeId, IsLocked, and PasswordAgeDays
app.get('/api/management', async (req, res) => {
  try {
    const pool = await getPool();

    const metaRes = await pool.request().query(
      'SELECT @@SERVERNAME AS serverName, DB_NAME() AS dbName'
    );
    const meta = metaRes.recordset.at(0);

    const usersRes = await pool.request().query(`
      SELECT 
        u.EmployeeId AS employeeId,
        u.LoginId AS loginId, 
        u.CompleteName AS name, 
        g.GroupName AS [group], 
        u.Status AS status,
        ISNULL(u.IsLocked, 0) AS isLocked,
        ISNULL(u.FailedAttempts, 0) AS failedAttempts,
        u.CreatedAt AS createdAt,
        u.PasswordUpdatedAt AS passwordUpdatedAt,
        DATEDIFF(
          DAY,
          CASE 
            WHEN u.PasswordUpdatedAt IS NOT NULL AND u.PasswordUpdatedAt > u.CreatedAt 
            THEN u.PasswordUpdatedAt 
            ELSE u.CreatedAt 
          END,
          GETDATE()
        ) AS passwordAgeDays
      FROM Users u
      LEFT JOIN Groups g ON u.GroupId = g.GroupId
      ORDER BY u.UserId ASC
    `);

    const groupsRes = await pool.request().query('SELECT GroupName FROM Groups ORDER BY GroupId');

    const rightsRes = await pool.request().query(`
      SELECT 
        g.GroupName, 
        gr.ModuleId, 
        gr.CanView, 
        gr.CanOperate, 
        gr.CanApprove 
      FROM GroupRights gr
      INNER JOIN Groups g ON gr.GroupId = g.GroupId
    `);

    const groups = groupsRes.recordset.map((g) => g.GroupName);
    const rights = {};
    groups.forEach((g) => {
      rights[g] = { users: { view: false, operate: false, approve: false } };
    });

    rightsRes.recordset.forEach((r) => {
      if (!rights[r.GroupName]) rights[r.GroupName] = {};
      rights[r.GroupName][r.ModuleId] = {
        view: Boolean(r.CanView),
        operate: Boolean(r.CanOperate),
        approve: Boolean(r.CanApprove)
      };
    });

    res.json({
      sqlInfo: {
        instance: meta.serverName,
        database: meta.dbName,
        tables: ['dbo.Users', 'dbo.Groups', 'dbo.GroupRights']
      },
      users: usersRes.recordset,
      groups,
      rights
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. ADD a new User (EmployeeId optional & unique if provided; Group required)
app.post('/api/users', async (req, res) => {
  const { employeeId, loginId, name, password, group } = req.body;
  const cleanEmployeeId =
    employeeId && String(employeeId).trim() ? String(employeeId).trim() : null;

  if (!group || !String(group).trim()) {
    return res.status(400).json({ error: 'Cannot create user without assigning a valid Group.' });
  }

  try {
    const pool = await getPool();

    const grpRes = await pool.request()
      .input('group', sql.NVarChar, String(group).trim())
      .query('SELECT TOP 1 GroupId FROM Groups WHERE GroupName = @group');

    const groupId = grpRes.recordset.at(0)?.GroupId;
    if (!groupId) {
      return res.status(400).json({ error: 'Cannot create user without assigning a valid Group.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.request()
      .input('employeeId', sql.NVarChar, cleanEmployeeId)
      .input('loginId', sql.NVarChar, String(loginId).trim())
      .input('name', sql.NVarChar, String(name).trim())
      .input('password', sql.NVarChar, hashedPassword)
      .input('groupId', sql.Int, groupId)
      .query(`
        INSERT INTO Users (EmployeeId, LoginId, CompleteName, PasswordHash, GroupId, Status, IsActive, IsLocked, FailedAttempts, PasswordUpdatedAt)
        VALUES (@employeeId, @loginId, @name, @password, @groupId, 'Active', 1, 0, 0, GETDATE())
      `);
    res.status(201).json({ success: true });
  } catch (err) {
    if (err.message.includes('UX_Users_EmployeeId_NotNull') || err.message.includes('UQ_Users_EmployeeId')) {
      return res.status(400).json({
        error: `Employee ID "${cleanEmployeeId}" already exists. Employee ID must be unique.`
      });
    }
    if (err.number === 2627 || err.number === 2601 || err.message.includes('UNIQUE KEY')) {
      return res.status(400).json({
        error: `User ID "${loginId}" already exists. You cannot create the same User ID Again.`
      });
    }
    res.status(400).json({ error: 'Unable to create user. Please check your details and try again.' });
  }
});



// 4. UPDATE User Group (Maps GroupName -> GroupId)
app.put('/api/users/:loginId/group', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input('loginId', sql.NVarChar, req.params.loginId)
      .input('group', sql.NVarChar, req.body.group)
      .query(`
        UPDATE Users 
        SET GroupId = (SELECT TOP 1 GroupId FROM Groups WHERE GroupName = @group)
        WHERE LoginId = @loginId
      `);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. DEACTIVATE User (Only modifies IsActive = 0; Admin & Self-Deactivation protected)
app.delete('/api/users/:loginId', async (req, res) => {
  const targetLoginId = req.params.loginId;
  const actorLoginId = req.headers['x-actor-id'] || req.body?.actorLoginId || '';

  if (targetLoginId.toLowerCase() === 'admin') {
    return res.status(403).json({
      error: 'Admin account cannot be deleted or deactivated.'
    });
  }

  if (actorLoginId && targetLoginId.toLowerCase() === String(actorLoginId).toLowerCase()) {
    return res.status(403).json({
      error: 'You cannot deactivate your own logged-in user account.'
    });
  }

  try {
    const pool = await getPool();
    await pool.request()
      .input('loginId', sql.NVarChar, targetLoginId)
      .query("UPDATE Users SET IsActive = 0, Status = 'Deactivated' WHERE LoginId = @loginId AND LoginId <> 'Admin'");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5B. ACTIVATE User (Only modifies IsActive = 1; does NOT touch IsLocked)
app.put('/api/users/:loginId/activate', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input('loginId', sql.NVarChar, req.params.loginId)
      .query(`
        UPDATE Users 
        SET IsActive = 1,
            Status = CASE WHEN ISNULL(IsLocked, 0) = 1 THEN 'Locked' ELSE 'Active' END
        WHERE LoginId = @loginId
      `);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5C. MANUAL UNLOCK User (Only resets IsLocked = 0 & FailedAttempts = 0; does NOT touch IsActive)
app.put('/api/users/:loginId/unlock', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input('loginId', sql.NVarChar, req.params.loginId)
      .query(`
        UPDATE Users 
        SET IsLocked = 0,
            FailedAttempts = 0,
            Status = CASE WHEN ISNULL(IsActive, 1) = 0 THEN 'Deactivated' ELSE 'Active' END
        WHERE LoginId = @loginId
      `);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// 6. ADD a new Group
app.post('/api/groups', async (req, res) => {
  const { groupName } = req.body;
  try {
    const pool = await getPool();
    await pool.request()
      .input('groupName', sql.NVarChar, groupName)
      .query('INSERT INTO Groups (GroupName) VALUES (@groupName)');
    res.status(201).json({ success: true });
  } catch (err) {
    if (err.number === 2627 || err.number === 2601 || err.message.includes('UNIQUE KEY')) {
      return res.status(400).json({
        error: `Group "${groupName}" already exists. Please choose a different group name.`
      });
    }
    res.status(400).json({ error: 'Unable to create group. Please try again.' });
  }
});

// 7. TOGGLE User Rights (Maps GroupName -> GroupId)
app.put('/api/rights', async (req, res) => {
  const { groupName, moduleId, view, operate, approve } = req.body;
  try {
    const pool = await getPool();
    await pool.request()
      .input('groupName', sql.NVarChar, groupName)
      .input('moduleId', sql.NVarChar, moduleId)
      .input('view', sql.Bit, view ? 1 : 0)
      .input('operate', sql.Bit, operate ? 1 : 0)
      .input('approve', sql.Bit, approve ? 1 : 0)
      .query(`
        DECLARE @gid INT = (SELECT TOP 1 GroupId FROM Groups WHERE GroupName = @groupName);

        MERGE GroupRights AS target
        USING (SELECT @gid AS GroupId, @moduleId AS ModuleId) AS source
        ON (target.GroupId = source.GroupId AND target.ModuleId = source.ModuleId)
        WHEN MATCHED THEN
          UPDATE SET CanView = @view, CanOperate = @operate, CanApprove = @approve
        WHEN NOT MATCHED AND @gid IS NOT NULL THEN
          INSERT (GroupId, ModuleId, CanView, CanOperate, CanApprove)
          VALUES (@gid, @moduleId, @view, @operate, @approve);
      `);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. OPERATOR LOGIN (Per-user 3-strike lock, Deactivated/Locked checks, and automatic Audit logging)
app.post('/api/login', async (req, res) => {
  const { loginId, password } = req.body;

  const writeSecurityAudit = async (userId, fullName, action, details) => {
    try {
      const dataPool = await getDataPool();
      await dataPool.request()
        .input('batchId', sql.NVarChar, 'SYSTEM')
        .input('userId', sql.NVarChar, userId)
        .input('completeName', sql.NVarChar, fullName || userId)
        .input('action', sql.NVarChar, action)
        .input('details', sql.NVarChar, details)
        .query(`
          INSERT INTO AuditTrail (BatchId, EventTime, UserId, CompleteName, Action, Details)
          VALUES (@batchId, GETDATE(), @userId, @completeName, @action, @details)
        `);
    } catch (auditErr) {
      console.error('Security audit error:', auditErr.message);
    }
  };

  try {
    const pool = await getPool();
    const userRes = await pool.request()
      .input('loginId', sql.NVarChar, loginId)
      .query(`
        SELECT 
          u.LoginId AS loginId,
          u.CompleteName AS name,
          u.PasswordHash AS passwordHash,
          u.Status AS status,
          ISNULL(u.FailedAttempts, 0) AS failedAttempts,
          u.GroupId AS groupId,
          g.GroupName AS groupName
        FROM Users u
        LEFT JOIN Groups g ON u.GroupId = g.GroupId
        WHERE u.LoginId = @loginId
      `);

    const user = userRes.recordset.at(0);

    if (!user) {
      await writeSecurityAudit(
        loginId || 'Unknown',
        loginId || 'Unknown',
        'Failed Login Attempt',
        `Unknown User ID attempted login: "${loginId}"`
      );
      return res.status(401).json({ error: `User ID "${loginId}" was not found.` });
    }

    if (user.status === 'Deactivated' || user.status === 'Inactive') {
      await writeSecurityAudit(
        user.loginId,
        user.name,
        'Deactivated User Login Attempt',
        `Deactivated User Account attempted login: ${user.loginId} (${user.groupName || 'No Group'})`
      );
      return res.status(403).json({
        error: `User Account "${user.loginId}" is deactivated. Contact an administrator.`
      });
    }

    if (user.status === 'Locked') {
      await writeSecurityAudit(
        user.loginId,
        user.name,
        'Locked User Login Attempt',
        `Locked User Account attempted login: ${user.loginId} (${user.groupName || 'No Group'})`
      );
      return res.status(403).json({
        error: `User Account "${user.loginId}" is LOCKED due to 3 consecutive wrong password attempts. Contact an administrator.`
      });
    }

    const isBcrypt = user.passwordHash && user.passwordHash.startsWith('$2');
    const isMatch = isBcrypt
      ? await bcrypt.compare(password, user.passwordHash)
      : password === user.passwordHash;

    if (!isMatch) {
      const nextAttempts = (user.failedAttempts || 0) + 1;

      if (nextAttempts >= 3 && user.loginId.toLowerCase() !== 'admin') {
        await pool.request()
          .input('loginId', sql.NVarChar, user.loginId)
          .input('attempts', sql.Int, nextAttempts)
          .query("UPDATE Users SET FailedAttempts = @attempts, Status = 'Locked' WHERE LoginId = @loginId");

        await writeSecurityAudit(
          user.loginId,
          user.name,
          'User Account Locked',
          `User Account Locked after 3 consecutive wrong password attempts: ${user.loginId} (${user.groupName || 'No Group'})`
        );

        return res.status(403).json({
          error: `Wrong Password Attempt! User Account "${user.loginId}" is now LOCKED after 3 consecutive wrong password attempts.`
        });
      }

      await pool.request()
        .input('loginId', sql.NVarChar, user.loginId)
        .input('attempts', sql.Int, nextAttempts)
        .query('UPDATE Users SET FailedAttempts = @attempts WHERE LoginId = @loginId');

      const remaining = Math.max(0, 3 - nextAttempts);
      await writeSecurityAudit(
        user.loginId,
        user.name,
        'Wrong Password Attempt',
        `Wrong Password Attempt (${nextAttempts}/3) for ${user.loginId} (${user.groupName || 'No Group'})`
      );

      return res.status(401).json({
        error: user.loginId.toLowerCase() === 'admin'
          ? 'Wrong Password Attempt!'
          : `Wrong Password Attempt! (${nextAttempts}/3 failed attempts — ${remaining} attempt(s) left before account lock)`
      });
    }

    if (user.failedAttempts > 0) {
      await pool.request()
        .input('loginId', sql.NVarChar, user.loginId)
        .query('UPDATE Users SET FailedAttempts = 0 WHERE LoginId = @loginId');
    }

    const rightsRes = await pool.request()
      .input('groupId', sql.Int, user.groupId)
      .query('SELECT ModuleId, CanView, CanOperate, CanApprove FROM GroupRights WHERE GroupId = @groupId');

    const permissions = {};
    rightsRes.recordset.forEach((r) => {
      permissions[r.ModuleId] = {
        view: Boolean(r.CanView),
        operate: Boolean(r.CanOperate),
        approve: Boolean(r.CanApprove)
      };
    });

    res.json({
      success: true,
      user: {
        loginId: user.loginId,
        name: user.name,
        group: user.groupName,
        permissions
      }
    });
  } catch (err) {
    console.error('❌ POST /api/login error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// AVI_IRS_DATA ROUTES (Alarms, AuditTrail, Events with Duration Lock)
// =========================================================================

// 9. GET all SCADA Data (Alarms, AuditTrail, Events) from AVI_IRS_DATA
app.get('/api/scada-data', async (req, res) => {
  try {
    const pool = await getDataPool();
    const alarmsRes = await pool.request().query('SELECT * FROM Alarms ORDER BY ActiveAt DESC');
    const auditRes = await pool.request().query('SELECT * FROM AuditTrail ORDER BY EventTime DESC');
    const eventsRes = await pool.request().query('SELECT * FROM Events ORDER BY Code ASC');

    res.json({
      alarms: alarmsRes.recordset,
      audit: auditRes.recordset,
      events: eventsRes.recordset
    });
  } catch (err) {
    console.error('❌ GET /api/scada-data error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 10. SAVE Audit Trail Entry (Automatically resolves CompleteName from AVI_IRS_UM)
app.post('/api/audit', async (req, res) => {
  const { batchId, user, completeName, action, details } = req.body;
  const userId = user || 'Admin';

  try {
    let resolvedFullName = completeName || '';
    if (!resolvedFullName) {
      const umPool = await getPool();
      const nameRes = await umPool.request()
        .input('uid', sql.NVarChar, userId)
        .query('SELECT TOP 1 CompleteName FROM Users WHERE LoginId = @uid');
      resolvedFullName = nameRes.recordset.at(0)?.CompleteName || userId;
    }

    const pool = await getDataPool();
    await pool.request()
      .input('batchId', sql.NVarChar, batchId || 'VIAL_BATCH_A')
      .input('userId', sql.NVarChar, userId)
      .input('completeName', sql.NVarChar, resolvedFullName)
      .input('action', sql.NVarChar, action)
      .input('details', sql.NVarChar, details)
      .query(`
        INSERT INTO AuditTrail (BatchId, EventTime, UserId, CompleteName, Action, Details)
        VALUES (@batchId, GETDATE(), @userId, @completeName, @action, @details)
      `);
    res.status(201).json({ success: true });
  } catch (err) {
    console.error('❌ POST /api/audit error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 11. SAVE / UPDATE Door or Glove Event with Automatic Duration & Lock
app.post('/api/events', async (req, res) => {
  const { id, code, batchId, type, asset, activity, category, status, operator } = req.body;
  try {
    const pool = await getDataPool();

    // Check if already locked in SQL Server
    const lockCheck = await pool.request()
      .input('id', sql.NVarChar, id)
      .query('SELECT IsLocked FROM Events WHERE EventId = @id');

    if (lockCheck.recordset.at(0)?.IsLocked) {
      return res.status(403).json({ error: 'This activity is completed and duration-locked.' });
    }

    await pool.request()
      .input('id', sql.NVarChar, id)
      .input('code', sql.NVarChar, code)
      .input('batchId', sql.NVarChar, batchId)
      .input('type', sql.NVarChar, type)
      .input('asset', sql.NVarChar, asset)
      .input('activity', sql.NVarChar, activity)
      .input('category', sql.NVarChar, category)
      .input('status', sql.NVarChar, status)
      .input('operator', sql.NVarChar, operator || '')
      .query(`
        MERGE Events AS target
        USING (SELECT @id AS EventId) AS source
        ON (target.EventId = source.EventId)
        WHEN MATCHED THEN
          UPDATE SET 
            Status = @status,
            OperatorId = @operator,
            EventTime = GETDATE(),
            CompletedAt = CASE WHEN @status = 'Complete' THEN GETDATE() ELSE target.CompletedAt END,
            DurationSeconds = CASE 
              WHEN @status = 'Complete' AND target.StartedAt IS NOT NULL 
              THEN DATEDIFF(SECOND, target.StartedAt, GETDATE()) 
              ELSE target.DurationSeconds 
            END,
            IsLocked = CASE WHEN @status = 'Complete' THEN 1 ELSE 0 END
        WHEN NOT MATCHED THEN
          INSERT (EventId, Code, BatchId, EventType, Asset, Activity, Category, Status, OperatorId, EventTime, StartedAt, CompletedAt, DurationSeconds, IsLocked)
          VALUES (
            @id, @code, @batchId, @type, @asset, @activity, @category, @status, @operator, GETDATE(),
            CASE WHEN @status = 'Running' THEN GETDATE() ELSE NULL END,
            CASE WHEN @status = 'Complete' THEN GETDATE() ELSE NULL END,
            0,
            CASE WHEN @status = 'Complete' THEN 1 ELSE 0 END
          );
      `);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ POST /api/events error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 12. SAVE / ACKNOWLEDGE / DEACTIVATE Alarm with Duration & Lock
app.post('/api/alarms', async (req, res) => {
  const { id, batchId, severity, source, message, acknowledged, acknowledgedBy, deactivated } = req.body;
  try {
    const pool = await getDataPool();

    const lockCheck = await pool.request()
      .input('id', sql.NVarChar, id)
      .query('SELECT IsLocked FROM Alarms WHERE AlarmId = @id');

    if (lockCheck.recordset.at(0)?.IsLocked) {
      return res.status(403).json({ error: 'This alarm is already deactivated and duration-locked.' });
    }

    await pool.request()
      .input('id', sql.NVarChar, id)
      .input('batchId', sql.NVarChar, batchId)
      .input('severity', sql.NVarChar, severity)
      .input('source', sql.NVarChar, source)
      .input('message', sql.NVarChar, message)
      .input('ack', sql.Bit, acknowledged ? 1 : 0)
      .input('ackBy', sql.NVarChar, acknowledgedBy || null)
      .input('deact', sql.Bit, deactivated ? 1 : 0)
      .query(`
        MERGE Alarms AS target
        USING (SELECT @id AS AlarmId) AS source
        ON (target.AlarmId = source.AlarmId)
        WHEN MATCHED THEN
          UPDATE SET 
            Acknowledged = @ack,
            AcknowledgedBy = COALESCE(@ackBy, target.AcknowledgedBy),
            AcknowledgedAt = CASE WHEN @ack = 1 AND target.AcknowledgedAt IS NULL THEN GETDATE() ELSE target.AcknowledgedAt END,
            DeactivatedAt = CASE WHEN @deact = 1 AND target.DeactivatedAt IS NULL THEN GETDATE() ELSE target.DeactivatedAt END,
            DurationSeconds = CASE 
              WHEN @deact = 1 AND target.DeactivatedAt IS NULL 
              THEN DATEDIFF(SECOND, target.ActiveAt, GETDATE()) 
              ELSE target.DurationSeconds 
            END,
            IsLocked = CASE WHEN @deact = 1 THEN 1 ELSE 0 END
        WHEN NOT MATCHED THEN
          INSERT (AlarmId, BatchId, Severity, Source, Message, ActiveAt, Acknowledged, IsLocked)
          VALUES (@id, @batchId, @severity, @source, @message, GETDATE(), @ack, 0);
      `);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ POST /api/alarms error:', err.message);
    res.status(500).json({ error: err.message });
  }
});



  // =========================================================================
// 13A. OMRON ETHERNET/IP DRIVER — CONFIG, CLEAN UNREGISTER & CIP SOCKET
// =========================================================================
let OMRON_PLC_IP = '192.168.0.2';
let OMRON_EIP_PORT = 44818;

const CIP_TYPES = {
  0x00C1: 'BOOL', 0x00C2: 'SINT', 0x00C3: 'INT', 0x00C4: 'DINT',
  0x00C6: 'USINT', 0x00C7: 'UINT', 0x00C8: 'UDINT', 0x00CA: 'REAL',
  0x00CB: 'LREAL', 0x00D0: 'STRING'
};
const CIP_TYPE_CODES = Object.fromEntries(
  Object.entries(CIP_TYPES).map(([k, v]) => [v, Number(k)])
);

const CANDIDATE_OMRON_TAGS = [
  'MACHINE_SPEED',
  'BATCH_COUNT',
  'TARGET_QTY',
  'ACTUAL_QTY',
  'MOTOR_RUN',
  'TEMP_PV',
  'PRESSURE_PV',
  'ALARM_CODE'
];

let omronTags = {
  driverId: 13,
  plcIp: OMRON_PLC_IP,
  plcPort: OMRON_EIP_PORT,
  connected: false,
  selectedTagName: 'MACHINE_SPEED',
  selectedTagType: 'REAL',
  selectedTagValue: 0,
  availableTags: [{ name: 'MACHINE_SPEED', type: 'REAL' }],
  lastUpdated: null,
  error: null
};

function buildCipSymbolPath(tagName) {
  const nameBuf = Buffer.from(tagName.trim(), 'ascii');
  const pathBuf = Buffer.alloc(2 + nameBuf.length + (nameBuf.length % 2));
  pathBuf.writeUInt8(0x91, 0);
  pathBuf.writeUInt8(nameBuf.length, 1);
  nameBuf.copy(pathBuf, 2);
  return pathBuf;
}

function sendOmronCipRequest(cipServicePayload) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let sessionHandle = 0;
    let step = 'register';
    let rxBuffer = Buffer.alloc(0);

    socket.setTimeout(3000);

    const closeCleanly = () => {
      if (sessionHandle !== 0 && !socket.destroyed) {
        const unreg = Buffer.alloc(24);
        unreg.writeUInt16LE(0x0066, 0);
        unreg.writeUInt32LE(sessionHandle, 4);
        socket.end(unreg);
      } else {
        socket.destroy();
      }
    };

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('PLC CIP response timeout'));
    });

    socket.on('error', (err) => {
      socket.destroy();
      reject(err);
    });

    socket.on('connect', () => {
      const regHeader = Buffer.alloc(28);
      regHeader.writeUInt16LE(0x0065, 0);
      regHeader.writeUInt16LE(4, 2);
      regHeader.writeUInt16LE(1, 24);
      regHeader.writeUInt16LE(0, 26);
      socket.write(regHeader);
    });

    socket.on('data', (chunk) => {
      rxBuffer = Buffer.concat([rxBuffer, chunk]);
      if (rxBuffer.length < 24) return;
      const payloadLen = rxBuffer.readUInt16LE(2);
      if (rxBuffer.length < 24 + payloadLen) return;

      const packet = rxBuffer.subarray(0, 24 + payloadLen);
      rxBuffer = rxBuffer.subarray(24 + payloadLen);

      if (step === 'register') {
        const status = packet.readUInt32LE(8);
        if (status !== 0) {
          socket.destroy();
          return reject(new Error(`RegisterSession failed (status ${status})`));
        }
        sessionHandle = packet.readUInt32LE(4);
        step = 'cip';

        const cpf = Buffer.alloc(16 + cipServicePayload.length);
        cpf.writeUInt32LE(0, 0);
        cpf.writeUInt16LE(5, 4);
        cpf.writeUInt16LE(2, 6);
        cpf.writeUInt16LE(0x0000, 8);
        cpf.writeUInt16LE(0, 10);
        cpf.writeUInt16LE(0x00B2, 12);
        cpf.writeUInt16LE(cipServicePayload.length, 14);
        cipServicePayload.copy(cpf, 16);

        const eipHeader = Buffer.alloc(24);
        eipHeader.writeUInt16LE(0x006F, 0);
        eipHeader.writeUInt16LE(cpf.length, 2);
        eipHeader.writeUInt32LE(sessionHandle, 4);

        socket.write(Buffer.concat([eipHeader, cpf]));
      } else if (step === 'cip') {
        closeCleanly();
        if (packet.length < 44) return reject(new Error('Invalid CIP reply packet'));
        const cipReply = packet.subarray(40);
        const generalStatus = cipReply.readUInt8(2);
        if (generalStatus !== 0x00 && generalStatus !== 0x06) {
          return reject(
            new Error(`Omron CIP Status 0x${generalStatus.toString(16).toUpperCase()}`)
          );
        }
        resolve(cipReply);
      }
    });

    socket.connect(OMRON_EIP_PORT, OMRON_PLC_IP);
  });
}
// =========================================================================
// 13B. OMRON ETHERNET/IP DRIVER — READ/WRITE, OVERLAP-SAFE POLLING & ROUTES
// =========================================================================
async function readOmronTag(tagName) {
  const sym = buildCipSymbolPath(tagName);
  const req = Buffer.concat([Buffer.from([0x4C, sym.length / 2]), sym, Buffer.from([0x01, 0x00])]);
  const reply = await sendOmronCipRequest(req);
  const code = reply.readUInt16LE(4);
  const typeName = CIP_TYPES[code] || `0x${code.toString(16)}`;

  let value;
  switch (code) {
    case 0x00C1: value = Boolean(reply.readUInt8(6) & 1); break;
    case 0x00C2: value = reply.readInt8(6); break;
    case 0x00C3: value = reply.readInt16LE(6); break;
    case 0x00C6: value = reply.readUInt8(6); break;
    case 0x00C7: value = reply.readUInt16LE(6); break;
    case 0x00C4: value = reply.readInt32LE(6); break;
    case 0x00C8: value = reply.readUInt32LE(6); break;
    case 0x00CA: value = Number(reply.readFloatLE(6).toFixed(2)); break;
    case 0x00CB: value = Number(reply.readDoubleLE(6).toFixed(4)); break;
    case 0x00D0: value = reply.subarray(8, 8 + reply.readUInt16LE(6)).toString('ascii'); break;
    default: throw new Error(`Unsupported datatype: ${typeName}`);
  }
  return { tagName: tagName.trim(), typeName, value };
}

async function writeOmronTag(tagName, typeName, value) {
  const sym = buildCipSymbolPath(tagName);
  const code = CIP_TYPE_CODES[String(typeName || 'REAL').toUpperCase()] || 0x00CA;
  let valBuf;

  if (code === 0x00C1) {
    valBuf = Buffer.alloc(2);
    valBuf.writeUInt16LE(value === true || value === 'true' || Number(value) === 1 ? 1 : 0);
  } else if (code === 0x00C2 || code === 0x00C6) {
    valBuf = Buffer.from([Number(value)]);
  } else if (code === 0x00C3 || code === 0x00C7) {
    valBuf = Buffer.alloc(2);
    valBuf.writeInt16LE(Number(value));
  } else if (code === 0x00C4 || code === 0x00C8) {
    valBuf = Buffer.alloc(4);
    valBuf.writeInt32LE(Number(value));
  } else if (code === 0x00CB) {
    valBuf = Buffer.alloc(8);
    valBuf.writeDoubleLE(Number(value));
  } else if (code === 0x00D0) {
    const str = Buffer.from(String(value), 'ascii');
    valBuf = Buffer.alloc(2 + str.length + (str.length % 2));
    valBuf.writeUInt16LE(str.length, 0);
    str.copy(valBuf, 2);
  } else {
    valBuf = Buffer.alloc(4);
    valBuf.writeFloatLE(Number(value));
  }

  const hdr = Buffer.alloc(4);
  hdr.writeUInt16LE(code, 0);
  hdr.writeUInt16LE(1, 2);
  await sendOmronCipRequest(Buffer.concat([Buffer.from([0x4D, sym.length / 2]), sym, hdr, valBuf]));
}

async function browseOmronTags() {
  const namesToCheck = new Set([
    ...CANDIDATE_OMRON_TAGS,
    ...(omronTags.selectedTagName ? [omronTags.selectedTagName] : []),
    ...omronTags.availableTags.map((t) => t.name)
  ]);

  const validTags = [];
  for (const name of namesToCheck) {
    try {
      const res = await readOmronTag(name);
      validTags.push({ name: res.tagName, type: res.typeName, value: res.value });
    } catch {
      // Skip tags that do not exist or are not Network Published
    }
  }
  omronTags.availableTags = validTags;
  return validTags;
}

// Overlap-safe polling loop (polls ONLY the selected tag every 1.5s)
let isPollingOmron = false;

setInterval(async () => {
  if (isPollingOmron) return;
  isPollingOmron = true;
  const targetTag = omronTags.selectedTagName || 'MACHINE_SPEED';
  try {
    const res = await readOmronTag(targetTag);
    if (!omronTags.connected) {
      console.log(`✅ [OMRON EIP #13] Connected to ${OMRON_PLC_IP}:${OMRON_EIP_PORT} | ${res.tagName} = ${res.value}`);
    }
    omronTags.connected = true;
    omronTags.selectedTagName = res.tagName;
    omronTags.selectedTagType = res.typeName;
    omronTags.selectedTagValue = res.value;
    omronTags.lastUpdated = new Date().toISOString();
    omronTags.error = null;
  } catch (err) {
    if (omronTags.connected || omronTags.error !== err.message) {
      console.error(`❌ [OMRON EIP #13] ${err.message}`);
    }
    omronTags.connected = false;
    omronTags.error = err.message;
  } finally {
    isPollingOmron = false;
  }
}, 1500);

app.post('/api/plc/omron-config', (req, res) => {
  const newIp = String(req.body?.plcIp || OMRON_PLC_IP).trim();
  const newPort = Number(req.body?.plcPort || OMRON_EIP_PORT);
  if (!newIp) return res.status(400).json({ error: 'plcIp is required.' });
  if (!Number.isInteger(newPort) || newPort < 1 || newPort > 65535) {
    return res.status(400).json({ error: 'Invalid port (1-65535).' });
  }
  OMRON_PLC_IP = newIp;
  OMRON_EIP_PORT = newPort;
  omronTags.plcIp = newIp;
  omronTags.plcPort = newPort;
  res.json({ success: true, plcIp: OMRON_PLC_IP, plcPort: OMRON_EIP_PORT });
});

app.get('/api/plc/omron-tags', (req, res) => res.json(omronTags));

app.get('/api/plc/omron-browse', async (req, res) => {
  try {
    const tags = await browseOmronTags();
    res.json({ success: true, count: tags.length, tags });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/plc/omron-select', async (req, res) => {
  const tagName = String(req.body?.tagName || '').trim();
  if (!tagName) return res.status(400).json({ error: 'tagName is required.' });
  try {
    const result = await readOmronTag(tagName);
    omronTags.connected = true;
    omronTags.selectedTagName = result.tagName;
    omronTags.selectedTagType = result.typeName;
    omronTags.selectedTagValue = result.value;
    omronTags.lastUpdated = new Date().toISOString();
    omronTags.error = null;
    if (!omronTags.availableTags.some((t) => t.name === result.tagName)) {
      omronTags.availableTags.push({ name: result.tagName, type: result.typeName });
    }
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/plc/omron-write', async (req, res) => {
  const targetName = req.body.tagName || omronTags.selectedTagName || 'MACHINE_SPEED';
  const targetType = req.body.typeName || omronTags.selectedTagType || 'REAL';
  try {
    await writeOmronTag(targetName, targetType, req.body.value);
    res.json({ success: true, tagName: targetName, typeName: targetType, value: req.body.value });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/// =========================================================================
// 13C. OMRON ETHERNET/IP DRIVER — POLLING LOOP & EXPRESS API ROUTES
// =========================================================================
setInterval(async () => {
  const targetTag = omronTags.selectedTagName || 'MACHINE_SPEED';
  try {
    const res = await readOmronTag(targetTag);
    if (!omronTags.connected) {
      console.log(`✅ [OMRON EIP #13] Connected to ${OMRON_PLC_IP}:${OMRON_EIP_PORT} | ${res.tagName} = ${res.value}`);
    }
    omronTags.connected = true;
    omronTags.selectedTagName = res.tagName;
    omronTags.selectedTagType = res.typeName;
    omronTags.selectedTagValue = res.value;
    omronTags.lastUpdated = new Date().toISOString();
    omronTags.error = null;
  } catch (err) {
    if (omronTags.connected || omronTags.error !== err.message) {
      console.error(`❌ [OMRON EIP #13] ${err.message}`);
    }
    omronTags.connected = false;
    omronTags.error = err.message;
  }
}, 1000);

app.post('/api/plc/omron-config', (req, res) => {
  const newIp = String(req.body?.plcIp || OMRON_PLC_IP).trim();
  const newPort = Number(req.body?.plcPort || OMRON_EIP_PORT);
  if (!newIp) return res.status(400).json({ error: 'plcIp is required.' });
  if (!Number.isInteger(newPort) || newPort < 1 || newPort > 65535) {
    return res.status(400).json({ error: 'Invalid port (1-65535).' });
  }
  OMRON_PLC_IP = newIp;
  OMRON_EIP_PORT = newPort;
  omronTags.plcIp = newIp;
  omronTags.plcPort = newPort;
  res.json({ success: true, plcIp: OMRON_PLC_IP, plcPort: OMRON_EIP_PORT });
});

app.get('/api/plc/omron-tags', (req, res) => res.json(omronTags));

app.get('/api/plc/omron-browse', async (req, res) => {
  try {
    const tags = await browseOmronTags();
    res.json({ success: true, count: tags.length, tags });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/plc/omron-select', async (req, res) => {
  const tagName = String(req.body?.tagName || '').trim();
  if (!tagName) return res.status(400).json({ error: 'tagName is required.' });
  try {
    const result = await readOmronTag(tagName);
    omronTags.connected = true;
    omronTags.selectedTagName = result.tagName;
    omronTags.selectedTagType = result.typeName;
    omronTags.selectedTagValue = result.value;
    omronTags.lastUpdated = new Date().toISOString();
    omronTags.error = null;
    if (!omronTags.availableTags.some((t) => t.name === result.tagName)) {
      omronTags.availableTags.push({ name: result.tagName, type: result.typeName });
    }
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/plc/omron-write', async (req, res) => {
  const targetName = req.body.tagName || omronTags.selectedTagName || 'MACHINE_SPEED';
  const targetType = req.body.typeName || omronTags.selectedTagType || 'REAL';
  try {
    await writeOmronTag(targetName, targetType, req.body.value);
    res.json({ success: true, tagName: targetName, typeName: targetType, value: req.body.value });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// =========================================================================
// 20A. USB FINGERPRINT SCANNER DRIVER — U.ARE.U 4500 RD SERVICE (PORT 11100)
// =========================================================================
const crypto = require('crypto');
const http = require('http');

let fingerprintState = {
  connected: false,
  deviceName: 'U.are.U® 4500 Fingerprint Reader',
  usbPnpId: '127.0.0.1:11100',
  rdPort: 11100,
  lastScanAt: null,
  lastTemplateHash: null,
  lastMatchedUser: null,
  lastQuality: null,
  statusMessage: 'Click "Detect USB" or place finger on U.are.U 4500',
  error: null
};

// Auto-create FingerprintTemplates table in AVI_IRS_UM
async function ensureFingerprintTable() {
  try {
    const pool = await getPool();
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'FingerprintTemplates')
      BEGIN
        CREATE TABLE FingerprintTemplates (
          Id INT IDENTITY(1,1) PRIMARY KEY,
          LoginId NVARCHAR(100) NOT NULL,
          EmployeeId NVARCHAR(100) NULL,
          FingerLabel NVARCHAR(50) DEFAULT 'Right Index',
          TemplateHash NVARCHAR(256) NOT NULL,
          RawTemplate NVARCHAR(MAX) NULL,
          Quality INT DEFAULT 0,
          CreatedAt DATETIME DEFAULT GETDATE()
        );
      END
    `);
  } catch (err) {
    console.error('❌ [USB FINGERPRINT #20] Table init error:', err.message);
  }
}
ensureFingerprintTable();

// Plain HTTP helper for custom RD Service verbs (RDSERVICE, DEVICEINFO, CAPTURE)
function sendRdHttpRequest(port, method, path, body = '') {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        timeout: 15000,
        headers: body
          ? {
              'Content-Type': 'text/xml; charset=utf-8',
              'Content-Length': Buffer.byteLength(body)
            }
          : {}
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data));
      }
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`RD Service timeout on port ${port}`));
    });
    req.on('error', (err) => reject(err));
    if (body) req.write(body);
    req.end();
  });
}

// Detect U.are.U 4500 RD Service on plain HTTP port 11100 / 11101
async function detectUsbFingerprintDevice() {
  const rdPorts = new Array(11100, 11101, 8004, 8005);
  for (const port of rdPorts) {
    try {
      // 1. Check RDSERVICE on '/' first (<RDService status="READY" info="...">)
      let xml = await sendRdHttpRequest(port, 'RDSERVICE', '/').catch(() => '');
      if (!xml || !xml.includes('<RDService')) {
        // 2. Fallback to DEVICEINFO on '/rd/info' (<DeviceInfo ...>)
        xml = await sendRdHttpRequest(port, 'DEVICEINFO', '/rd/info');
      }

      if (xml && (xml.includes('<RDService') || xml.includes('<DeviceInfo'))) {
        const statusMatch = xml.match(/status="([^"]+)"/i);
        const infoMatch = xml.match(/info="([^"]+)"/i);
        const statusStr = statusMatch ? statusMatch.at(1).toUpperCase() : 'READY';
        const isReady = statusStr === 'READY';

        fingerprintState.connected = isReady;
        fingerprintState.rdPort = port;
        fingerprintState.deviceName = infoMatch
          ? `${infoMatch.at(1)} (Port ${port})`
          : `U.are.U® 4500 Fingerprint Reader (Port ${port})`;
        fingerprintState.usbPnpId = `127.0.0.1:${port}`;
        fingerprintState.error = isReady ? null : `RD Service status: ${statusStr}`;
        fingerprintState.statusMessage = isReady
          ? `USB Ready on Port ${port} — Place finger on U.are.U 4500`
          : `Scanner status: ${statusStr} — Check USB cable or RD registration`;
        return fingerprintState;
      }
    } catch {
      // Try next port
    }
  }

  fingerprintState.connected = false;
  fingerprintState.deviceName = 'U.are.U 4500 RD Service Offline';
  fingerprintState.statusMessage = 'Start Precision/DigitalPersona RD Service and click Detect USB';
  return fingerprintState;
}

// Trigger Blue LED Capture on U.are.U 4500
async function captureFromUsbScanner(manualPayload) {
  if (manualPayload && String(manualPayload).trim()) {
    return { templateData: String(manualPayload).trim(), quality: 85, source: 'MANUAL_INPUT' };
  }

  await detectUsbFingerprintDevice();
  if (!fingerprintState.connected || !fingerprintState.rdPort) {
    throw new Error(fingerprintState.statusMessage);
  }

  // env="PP" enables local capture on U.are.U 4500 RD Service
  const pidOptions =
    '<?xml version="1.0"?><PidOptions ver="1.0"><Opts fCount="1" fType="0" iCount="0" pCount="0" format="0" pidVer="2.0" timeout="10000" posh="UNKNOWN" env="PP" /></PidOptions>';

  const xml = await sendRdHttpRequest(fingerprintState.rdPort, 'CAPTURE', '/rd/capture', pidOptions);
  const errMatch = xml.match(/errCode="(\d+)"/);
  const infoMatch = xml.match(/errInfo="([^"]*)"/);
  const qMatch = xml.match(/qScore="(\d+)"/);
  const dataMatch = xml.match(/<Data[^>]*>([^<]+)<\/Data>/);

  if (errMatch && errMatch.at(1) !== '0') {
    throw new Error(infoMatch ? infoMatch.at(1) : `U.are.U Capture Error ${errMatch.at(1)}`);
  }
  if (!dataMatch || !dataMatch.at(1)) {
    throw new Error('No biometric template returned from U.are.U 4500.');
  }

  return {
    templateData: dataMatch.at(1),
    quality: qMatch ? Number(qMatch.at(1)) : 80,
    source: 'U_ARE_U_4500_USB'
  };
}

// Probe U.are.U 4500 RD Service on server startup
detectUsbFingerprintDevice();



// =========================================================================
// 20B. USB FINGERPRINT SCANNER — EXPRESS API ROUTES
// =========================================================================

// GET /api/fingerprint/status -> Scanner state & SQL enrolled templates
app.get('/api/fingerprint/status', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT Id, LoginId, EmployeeId, FingerLabel, Quality,
             LEFT(TemplateHash, 16) + '...' AS TemplatePreview,
             CreatedAt
      FROM FingerprintTemplates
      ORDER BY CreatedAt DESC
    `);
    res.json({
      scanner: fingerprintState,
      templates: result.recordset || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message, scanner: fingerprintState, templates: [] });
  }
});

// POST /api/fingerprint/detect -> Probe U.are.U 4500 RD Service on port 11100
app.post('/api/fingerprint/detect', async (req, res) => {
  const state = await detectUsbFingerprintDevice();
  res.json({ success: state.connected, scanner: state });
});

// POST /api/fingerprint/enroll -> Capture USB scan & save template in SQL
app.post('/api/fingerprint/enroll', async (req, res) => {
  const { loginId, employeeId, fingerLabel, scanPayload } = req.body || {};
  if (!loginId) return res.status(400).json({ error: 'Operator Login ID is required.' });

  try {
    const capture = await captureFromUsbScanner(scanPayload);
    const templateHash = crypto.createHash('sha256').update(capture.templateData).digest('hex');

    const pool = await getPool();
    await pool.request()
      .input('LoginId', sql.NVarChar(100), String(loginId).trim())
      .input('EmployeeId', sql.NVarChar(100), String(employeeId || '').trim())
      .input('FingerLabel', sql.NVarChar(50), String(fingerLabel || 'Right Index').trim())
      .input('TemplateHash', sql.NVarChar(256), templateHash)
      .input('RawTemplate', sql.NVarChar(sql.MAX), capture.templateData)
      .input('Quality', sql.Int, capture.quality)
      .query(`
        INSERT INTO FingerprintTemplates (LoginId, EmployeeId, FingerLabel, TemplateHash, RawTemplate, Quality)
        VALUES (@LoginId, @EmployeeId, @FingerLabel, @TemplateHash, @RawTemplate, @Quality)
      `);

    fingerprintState.lastScanAt = new Date().toISOString();
    fingerprintState.lastTemplateHash = templateHash;
    fingerprintState.lastMatchedUser = String(loginId).trim();
    fingerprintState.lastQuality = capture.quality;
    fingerprintState.statusMessage = `Enrolled ${fingerLabel || 'Right Index'} for ${loginId} (Quality: ${capture.quality}%)`;
    fingerprintState.error = null;

    res.json({
      success: true,
      loginId: String(loginId).trim(),
      quality: capture.quality,
      scanner: fingerprintState
    });
  } catch (err) {
    fingerprintState.error = err.message;
    res.status(400).json({ error: err.message, scanner: fingerprintState });
  }
});

// POST /api/fingerprint/verify -> Capture USB scan & match against SQL templates
app.post('/api/fingerprint/verify', async (req, res) => {
  const { scanPayload } = req.body || {};
  try {
    const capture = await captureFromUsbScanner(scanPayload);
    const hash = crypto.createHash('sha256').update(capture.templateData).digest('hex');

    const pool = await getPool();
    const queryResult = await pool.request()
      .input('TemplateHash', sql.NVarChar(256), hash)
      .query('SELECT TOP 1 * FROM FingerprintTemplates WHERE TemplateHash = @TemplateHash');

    const match = queryResult.recordset?.at(0);
    fingerprintState.lastScanAt = new Date().toISOString();
    fingerprintState.lastQuality = capture.quality;

    if (!match) {
      fingerprintState.lastMatchedUser = null;
      fingerprintState.statusMessage = 'Fingerprint not recognized';
      return res.status(404).json({ matched: false, message: 'No matching fingerprint found.' });
    }

    fingerprintState.lastMatchedUser = match.LoginId;
    fingerprintState.lastTemplateHash = match.TemplateHash;
    fingerprintState.statusMessage = `Verified: ${match.LoginId} (${match.FingerLabel})`;

    res.json({
      matched: true,
      loginId: match.LoginId,
      employeeId: match.EmployeeId,
      fingerLabel: match.FingerLabel,
      quality: capture.quality,
      verifiedAt: fingerprintState.lastScanAt
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/fingerprint/templates/:id -> Remove enrolled template
app.delete('/api/fingerprint/templates/:id', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input('Id', sql.Int, Number(req.params.id))
      .query('DELETE FROM FingerprintTemplates WHERE Id = @Id');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



app.listen(5000, '0.0.0.0', () => {
  console.log('✅ API RUNNING ON http://127.0.0.1:5000');
});

