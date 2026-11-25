import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import Management from './03_Management'
import Reports from './04_reports'
import Alarms from './05_Alarms'
import BatchControl from './06_BatchControl'
import Footer from './07_Footer'
import Header from './08_Header'
import Audit from './09_AuditTrail'
import FingerScanner from './20_FingerScanner'
import { formatDateTime, formatDuration } from '../utils/dateTime'

const operationTabs = [
  { id: 'overview', label: 'Batch Overview' },
  { id: 'batch', label: 'Batch Control' },
  { id: 'door', label: 'Door' },
  { id: 'glove', label: 'Glove' },
  { id: 'alarms', label: 'Alarms' },
  { id: 'reports', label: 'Reports' },
  { id: 'trend', label: 'Live Trend' },
  { id: 'audit', label: 'Audit Trail' },
  { id: 'users', label: 'User Management' },
  { id: 'fingerprint', label: 'Fingerprint scanner' }

]

const batches = [
  {
    id: 'VIAL_BATCH_A',
    product: '40 mL Tubular Vial',
    equipmentName: 'Tubular Vial Filling Line',
    equipmentId: 'FILL_LINE_A',
    status: 'Running',
    startedAt: new Date().toISOString(),
    stoppedAt: null,
    doors: ['Door 01', 'Door 02', 'Door 03'],
    gloves: ['Glove Port 01', 'Glove Port 02', 'Glove Port 03', 'Glove Port 04']
  },
  {
    id: 'VIAL_BATCH_B',
    product: '20 mL Tubular Vial',
    equipmentName: 'Tubular Vial Filling Line',
    equipmentId: 'FILL_LINE_B',
    status: 'Ready',
    startedAt: null,
    stoppedAt: null,
    doors: ['Door 01', 'Door 02', 'Door 03', 'Door 04'],
    gloves: [
      'Glove Port 01',
      'Glove Port 02',
      'Glove Port 03',
      'Glove Port 04',
      'Glove Port 05',
      'Glove Port 06'
    ]
  },
  {
    id: 'AMPOULE_BATCH_A',
    product: '10 mL Ampoule',
    equipmentName: 'Ampoule Filling Line',
    equipmentId: 'AMP_LINE_A',
    status: 'Ready',
    startedAt: null,
    stoppedAt: null,
    doors: ['Door 01', 'Door 02'],
    gloves: ['Glove Port 01', 'Glove Port 02', 'Glove Port 03']
  }
]

const doorActivities = [
  { name: 'Verify door interlock and closed status', category: 'Preventive' },
  { name: 'Inspect door seal and gasket condition', category: 'Preventive' },
  { name: 'Sanitize handle and contact surfaces', category: 'Preventive' },
  { name: 'Check door closer operation', category: 'Preventive' },
  { name: 'Verify room pressure before opening', category: 'Preventive' },
  { name: 'Confirm transfer hatch lock status', category: 'Preventive' },
  { name: 'Inspect viewing panel and frame', category: 'Preventive' },
  { name: 'Record area cleaning status', category: 'Preventive' },
  { name: 'Verify emergency release operation', category: 'Preventive' },
  { name: 'Respond to reported door-seal defect', category: 'Corrective' },
  { name: 'Reset verified door interlock fault', category: 'Corrective' },
  { name: 'Supervisor review and sign-off', category: 'Verification' }
]

const gloveActivities = [
  { name: 'Verify glove identification and location', category: 'Preventive' },
  { name: 'Inspect glove exterior under task lighting', category: 'Preventive' },
  { name: 'Check fingertips for visible damage', category: 'Preventive' },
  { name: 'Inspect palm and finger surfaces', category: 'Preventive' },
  { name: 'Check cuff and retaining ring condition', category: 'Preventive' },
  { name: 'Inspect sleeve and glove connection', category: 'Preventive' },
  { name: 'Confirm glove sanitization completed', category: 'Preventive' },
  { name: 'Set up approved integrity test device', category: 'Preventive' },
  { name: 'Verify integrity tester calibration status', category: 'Preventive' },
  { name: 'Perform glove integrity test', category: 'Verification' },
  { name: 'Replace damaged glove or sleeve', category: 'Corrective' },
  { name: 'QA review and sign-off', category: 'Verification' }
]

const permissionModules = [
  { id: 'overview', label: 'Batch Overview' },
  { id: 'batch', label: 'Batch Control' },
  { id: 'door', label: 'Door' },
  { id: 'glove', label: 'Glove' },
  { id: 'alarms', label: 'Alarms' },
  { id: 'reports', label: 'Reports' },
  { id: 'trend', label: 'Live Trend' },
  { id: 'audit', label: 'Audit Trail' },
  { id: 'users', label: 'User Management' }
]

const initialAlarms = [
  {
    id: 'AL-0031',
    batchId: 'VIAL_BATCH_A',
    severity: 'Warning',
    source: 'Glove Port 02',
    message: 'Integrity test due before next use',
    activeAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    deactivatedAt: null,
    acknowledged: false,
    acknowledgedAt: null,
    acknowledgedBy: ''
  },
  {
    id: 'AL-0030',
    batchId: 'VIAL_BATCH_A',
    severity: 'Info',
    source: 'Door 03',
    message: 'Door cycle completed',
    activeAt: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
    deactivatedAt: new Date(Date.now() - 24 * 60 * 1000).toISOString(),
    acknowledged: true,
    acknowledgedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    acknowledgedBy: 'Admin'
  },
  {
    id: 'AL-0029',
    batchId: 'VIAL_BATCH_A',
    severity: 'Warning',
    source: 'Filling Room A',
    message: 'Pressure trend approaching action limit',
    activeAt: new Date(Date.now() - 47 * 60 * 1000).toISOString(),
    deactivatedAt: null,
    acknowledged: false,
    acknowledgedAt: null,
    acknowledgedBy: ''
  }
]

function buildInitialInterventions() {
  return batches.flatMap((batch) => [
    ...batch.doors.flatMap((asset, assetIndex) =>
      doorActivities.map((activity, activityIndex) => {
        const completed = batch.id === 'VIAL_BATCH_A' && assetIndex === 0 && activityIndex < 3
        const running = batch.id === 'VIAL_BATCH_A' && assetIndex === 0 && activityIndex === 3
        return {
          id: `${batch.id}:${asset}:door:${activityIndex}`,
          code: `DR${String(assetIndex + 1).padStart(2, '0')}${String(activityIndex + 1).padStart(3, '0')}`,
          batchId: batch.id,
          type: 'door',
          asset,
          activity: activity.name,
          category: activity.category,
          status: completed ? 'Complete' : running ? 'Running' : 'Pending',
          operator: completed || running ? 'Admin' : '',
          time: completed ? '08:14:00' : running ? '11:10:00' : ''
        }
      })
    ),
    ...batch.gloves.flatMap((asset, assetIndex) =>
      gloveActivities.map((activity, activityIndex) => {
        const completed = batch.id === 'VIAL_BATCH_A' && assetIndex === 0 && activityIndex < 2
        const running = batch.id === 'VIAL_BATCH_A' && assetIndex === 0 && activityIndex === 2
        return {
          id: `${batch.id}:${asset}:glove:${activityIndex}`,
          code: `GL${String(assetIndex + 1).padStart(2, '0')}${String(activityIndex + 1).padStart(3, '0')}`,
          batchId: batch.id,
          type: 'glove',
          asset,
          activity: activity.name,
          category: activity.category,
          status: completed ? 'Complete' : running ? 'Running' : 'Pending',
          operator: completed || running ? 'Admin' : '',
          time: completed ? '08:26:00' : running ? '11:18:00' : ''
        }
      })
    )
  ])
}

function buildInitialAuditEntries(loginId) {
  const activeItems = buildInitialInterventions().filter((item) => item.status !== 'Pending')
  return [
    ...activeItems.map((item) => ({
      id: `audit-${item.id}`,
      batchId: item.batchId,
      time: new Date().toISOString(),
      user: item.operator,
      action: item.status === 'Running' ? 'Intervention started' : 'Intervention completed',
      details: `${item.asset} · ${item.activity} · ${item.category}`
    })),
    {
      id: 'audit-session',
      batchId: batches[0].id,
      time: new Date().toISOString(),
      user: loginId,
      action: 'Batch workspace opened',
      details: `${batches[0].id} · ${batches[0].product}`
    }
  ]
}

const defaultUsers = [
  { loginId: 'Admin', name: 'System Administrator', group: 'Administrators', status: 'Active' },
  { loginId: 'operator02', name: 'Operator 02', group: 'Operators', status: 'Active' },
  { loginId: 'qa-review', name: 'Quality Reviewer', group: 'Quality Assurance', status: 'Active' }
]

function createGroupRights(role) {
  return Object.fromEntries(
    permissionModules.map((module) => [
      module.id,
      {
        view: true,
        operate: role === 'admin' || (role === 'operator' && module.id !== 'users'),
        approve: role === 'admin' || (role === 'quality' && module.id === 'reports')
      }
    ])
  )
}
function Welcome({
  currentUser,
  onLogout,
  sqlInfo,
  users,
  groups,
  rights,
  selectedRightsGroup,
  managementMessage,
  onAddUser,
  onRemoveUser,
  onActivateUser,
  onUnlockUser,
  onUpdateUserGroup,
  onAddGroup,
  onRemoveGroup,
  onToggleRight,
  onSelectRightsGroup
}) {
  const [alarms, setAlarms] = useState(initialAlarms)
  const loginId = currentUser?.loginId || 'Admin'

  // Load saved Alarms from AVI_IRS_DATA » dbo.Alarms when Welcome opens
  useEffect(() => {
    fetch('http://' + '127.0.0.1' + ':5000/api/scada-data')
      .then((res) => res.json())
      .then((data) => {
        if (data.alarms && data.alarms.length > 0) {
          setAlarms(
            data.alarms.map((a) => ({
              id: a.AlarmId,
              batchId: a.BatchId,
              severity: a.Severity,
              source: a.Source,
              message: a.Message,
              activeAt: a.ActiveAt,
              deactivatedAt: a.DeactivatedAt,
              acknowledged: Boolean(a.Acknowledged),
              acknowledgedAt: a.AcknowledgedAt,
              acknowledgedBy: a.AcknowledgedBy || '',
              isLocked: Boolean(a.IsLocked)
            }))
          )
        }
      })
      .catch(() => {})
  }, [])

  return (
    <main className="hmi-login">
      <Header alarms={alarms} />

      <section className="hmi-frame" aria-labelledby="login-title">
        <div className="frame-titlebar">
          <span id="login-title">Operations Dashboard</span>
          <span className="frame-reference">OPERATOR WORKSPACE / 01</span>
        </div>

        <OperationsDashboard
          alarms={alarms}
          loginId={loginId}
          userGroup={currentUser?.group || 'Administrators'}
          userPermissions={currentUser?.permissions || null}
          onSignOut={onLogout}
          setAlarms={setAlarms}
          sqlInfo={sqlInfo}
          users={users}
          groups={groups}
          rights={rights}
          selectedRightsGroup={selectedRightsGroup}
          managementMessage={managementMessage}
          onAddUser={onAddUser}
          onRemoveUser={onRemoveUser}
          onActivateUser={onActivateUser}
          onUnlockUser={onUnlockUser}
          onUpdateUserGroup={onUpdateUserGroup}
          onAddGroup={onAddGroup}
          onRemoveGroup={onRemoveGroup}
          onToggleRight={onToggleRight}
          onSelectRightsGroup={onSelectRightsGroup}
        />
      </section>
    </main>
  )
}

function OperationsDashboard({
  alarms,
  loginId,
  onSignOut,
  setAlarms,
  sqlInfo,
  users,
  groups,
  rights,
  selectedRightsGroup,
  managementMessage,
  onAddUser,
  onRemoveUser,
  onActivateUser,
  onUnlockUser,
  onUpdateUserGroup,
  onAddGroup,
  onRemoveGroup,
  onToggleRight,
  onSelectRightsGroup
}) 

{
  const [activeTab, setActiveTab] = useState('overview')
  const [batchList, setBatchList] = useState(batches)
  const [selectedBatchId, setSelectedBatchId] = useState(batches[0].id)
  const [selectedDoor, setSelectedDoor] = useState(batches[0].doors[0])
  const [selectedGlove, setSelectedGlove] = useState(batches[0].gloves[0])
  const [interventions, setInterventions] = useState(buildInitialInterventions)
  const [auditEntries, setAuditEntries] = useState([])
  const [batchMessage, setBatchMessage] = useState('')

    // ✅ Load saved AuditTrail and Events from SQL Server (AVI_IRS_DATA)
  useEffect(() => {
    fetch('http://' + '127.0.0.1' + ':5000/api/scada-data')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.audit)) {
          setAuditEntries(
            data.audit.map((row) => ({
              id: `sql-audit-${row.AuditId}`,
              batchId: row.BatchId,
              time: row.EventTime,
              user: row.UserId,
              completeName: row.CompleteName || row.UserId, // 👈 HERE in 02_Welcome.jsx
              action: row.Action,
              details: row.Details
            }))
          )
        }


        if (Array.isArray(data.events) && data.events.length > 0) {
          setInterventions((currentItems) =>
            currentItems.map((item) => {
              const saved = data.events.find((e) => e.EventId === item.id)
              if (!saved) return item
              return {
                ...item,
                status: saved.Status,
                operator: saved.OperatorId || '',
                time: saved.EventTime || '',
                startedAt: saved.StartedAt || null,
                completedAt: saved.CompletedAt || null,
                duration:
                  saved.DurationSeconds != null ? `${saved.DurationSeconds}s` : '',
                isLocked: Boolean(saved.IsLocked)
              }
            })
          )
        }
      })
      .catch((err) => console.error('Failed to load AVI_IRS_DATA:', err))
  }, [])

  // ✅ LIVE SQL RIGHTS & LOCK ENGINE (Looks up logged-in user's group from SQL users)
  const activeUserRecord = users.find(
    (u) => u.loginId.toLowerCase() === String(loginId).toLowerCase()
  )
  const userGroup = activeUserRecord?.group || 'Operators'
  const groupPermissions = rights[userGroup] || {}

  const hasRight = (moduleId, action) => {
    if (userGroup === 'Administrators') return true
    return Boolean(groupPermissions[moduleId]?.[action])
  }

  // Returns: 'disabled' (no View) | 'locked' (View only, no Operate/Approve) | 'normal'
  const getTabAccess = (moduleId) => {
    const canView = hasRight(moduleId, 'view')
    const canOperate = hasRight(moduleId, 'operate')
    const canApprove = hasRight(moduleId, 'approve')

    if (!canView) return 'disabled'
    if (!canOperate && !canApprove) return 'locked'
    return 'normal'
  }

  const firstAllowedTab = operationTabs.find((t) => hasRight(t.id, 'view'))?.id || 'overview'
  const effectiveTab = hasRight(activeTab, 'view') ? activeTab : firstAllowedTab

    const selectedBatch = batchList.find((batch) => batch.id === selectedBatchId) || batchList.at(0)
  const batchInterventions = interventions.filter((item) => item.batchId === selectedBatchId)
  const batchDoorInterventions = batchInterventions.filter((item) => item.type === 'door')
  const batchGloveInterventions = batchInterventions.filter((item) => item.type === 'glove')
  const batchAlarms = alarms.filter((alarm) => (alarm.batchId || alarm.BatchId) === selectedBatchId)
  const batchAuditEntries = auditEntries.filter(
    (entry) =>
      entry.batchId === selectedBatchId ||
      entry.batchId === 'SYSTEM' ||
      entry.action.startsWith('Operator') ||
      entry.action.startsWith('User') ||
      entry.action.startsWith('Group') ||
      entry.action.startsWith('Failed login')
  )
  const completedDoorCount = batchDoorInterventions.filter(
    (item) => item.status === 'Complete'
  ).length
  const completedGloveCount = batchGloveInterventions.filter(
    (item) => item.status === 'Complete'
  ).length
  const runningCount = batchInterventions.filter((item) => item.status === 'Running').length
  const pendingAlarmCount = batchAlarms.filter((alarm) => !alarm.acknowledged).length

  const recordAudit = async (action, details, batchId = selectedBatchId) => {
    const nowIso = new Date().toISOString()
    const fullName =
      users.find((u) => u.loginId.toLowerCase() === String(loginId).toLowerCase())?.name ||
      loginId

    setAuditEntries((currentEntries) => [
      {
        id: `${Date.now()}-${Math.random()}`,
        batchId,
        time: nowIso,
        user: loginId,
        completeName: fullName,
        action,
        details
      },
      ...currentEntries
    ])

    try {
      await fetch('http://' + '127.0.0.1' + ':5000/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId,
          user: loginId,
          completeName: fullName,
          action,
          details
        })
      })
    } catch (err) {
      console.error('Failed to save audit entry to SQL Server:', err)
    }
  }


  // ✅ AUTO-AUDIT WRAPPERS FOR USER MANAGEMENT & SESSION
  const handleAddUserWithAudit = async (user) => {
    const ok = await onAddUser(user)
    if (ok) {
      await recordAudit(
        'User created',
        `${user.loginId} · ${user.name} · Group: ${user.group}`
      )
    }
    return ok
  }

  const handleRemoveUserWithAudit = async (targetLoginId) => {
    await onRemoveUser(targetLoginId)
    await recordAudit('User removed', `Deleted operator account: ${targetLoginId}`)
  }

  const handleUpdateUserGroupWithAudit = async (targetLoginId, newGroup) => {
    await onUpdateUserGroup(targetLoginId, newGroup)
    await recordAudit(
      'User group changed',
      `${targetLoginId} assigned to ${newGroup}`
    )
  }

  const handleAddGroupWithAudit = async (groupName) => {
    const ok = await onAddGroup(groupName)
    if (ok) {
      await recordAudit('Group created', `Created security group: ${groupName}`)
    }
    return ok
  }

  const handleToggleRightWithAudit = async (moduleId, actionId) => {
    const wasGranted = Boolean(rights[selectedRightsGroup]?.[moduleId]?.[actionId])
    await onToggleRight(moduleId, actionId)
    await recordAudit(
      'User right changed',
      `${selectedRightsGroup} · ${moduleId} · ${actionId.toUpperCase()} ${wasGranted ? 'revoked' : 'granted'}`
    )
  }

  const handleSignOutWithAudit = async () => {
    await recordAudit('Operator signed out', `Session closed for ${loginId}`)
    onSignOut()
  }

  const selectBatch = (batchId) => {
    const batch = batchList.find((item) => item.id === batchId)
    if (!batch) return
    setSelectedBatchId(batchId)
    setSelectedDoor(batch.doors)
    setSelectedGlove(batch.gloves)
    recordAudit('Batch selected', `${batch.id} · ${batch.product}`, batch.id)
  }

  const createBatch = (details) => {
    if (!hasRight('batch', 'operate')) {
      setBatchMessage('🔒 Locked: Your group does not have Operate permission for Batch Control.')
      return false
    }
    const batchId = details.id.trim()
    if (!/^[A-Za-z_]+$/.test(batchId)) {
      setBatchMessage('Batch number may contain letters and underscores only.')
      return false
    }
    if (batchList.some((batch) => batch.id.toLowerCase() === batchId.toLowerCase())) {
      setBatchMessage('That batch number already exists.')
      return false
    }

    const newBatch = {
      ...details,
      id: batchId,
      status: 'Ready',
      startedAt: null,
      stoppedAt: null,
      doors: ['Door 01', 'Door 02', 'Door 03'],
      gloves: ['Glove Port 01', 'Glove Port 02', 'Glove Port 03', 'Glove Port 04']
    }
    const newInterventions = [
      ...newBatch.doors.flatMap((asset, assetIndex) =>
        doorActivities.map((activity, activityIndex) => ({
          id: `${batchId}:${asset}:door:${activityIndex}`,
          code: `DR${String(assetIndex + 1).padStart(2, '0')}${String(activityIndex + 1).padStart(3, '0')}`,
          batchId,
          type: 'door',
          asset,
          activity: activity.name,
          category: activity.category,
          status: 'Pending',
          operator: '',
          time: ''
        }))
      ),
      ...newBatch.gloves.flatMap((asset, assetIndex) =>
        gloveActivities.map((activity, activityIndex) => ({
          id: `${batchId}:${asset}:glove:${activityIndex}`,
          code: `GL${String(assetIndex + 1).padStart(2, '0')}${String(activityIndex + 1).padStart(3, '0')}`,
          batchId,
          type: 'glove',
          asset,
          activity: activity.name,
          category: activity.category,
          status: 'Pending',
          operator: '',
          time: ''
        }))
      )
    ]

    setBatchList((currentBatches) => [...currentBatches, newBatch])
    setInterventions((currentItems) => [...currentItems, ...newInterventions])
    setSelectedBatchId(batchId)
    setSelectedDoor(newBatch.doors)
    setSelectedGlove(newBatch.gloves)
    setBatchMessage('')
    recordAudit('Batch created', `${batchId} · ${newBatch.product}`, batchId)
    return true
  }

  const startBatch = (batchId) => {
    if (!hasRight('batch', 'operate')) {
      setBatchMessage('🔒 Locked: Your group does not have Operate permission for Batch Control.')
      return
    }
    if (batchList.some((batch) => batch.status === 'Running' && batch.id !== batchId)) {
      setBatchMessage('Stop the currently running batch before starting another.')
      return
    }
    const startedAt = new Date().toISOString()
    setBatchList((currentBatches) =>
      currentBatches.map((batch) =>
        batch.id === batchId ? { ...batch, status: 'Running', startedAt, stoppedAt: null } : batch
      )
    )
    recordAudit(
      'Batch started',
      `${batchId} · ${batchList.find((batch) => batch.id === batchId)?.product}`,
      batchId
    )
    setBatchMessage('')
  }

  const stopBatch = (batchId) => {
    if (!hasRight('batch', 'operate')) {
      setBatchMessage('🔒 Locked: Your group does not have Operate permission for Batch Control.')
      return
    }
    const stoppedAt = new Date().toISOString()
    setBatchList((currentBatches) =>
      currentBatches.map((batch) =>
        batch.id === batchId ? { ...batch, status: 'Stopped', stoppedAt } : batch
      )
    )
    recordAudit(
      'Batch stopped',
      `${batchId} · ${batchList.find((batch) => batch.id === batchId)?.product}`,
      batchId
    )
    setBatchMessage('')
  }

  const updateIntervention = async (item) => {
    if (item.isLocked || item.status === 'Complete') return

    const requiredAction = item.category === 'Verification' ? 'approve' : 'operate'
    if (!hasRight(item.type, requiredAction)) {
      alert(
        `🔒 Locked: Your group requires "${requiredAction.toUpperCase()}" permission for ${item.type.toUpperCase()} (${item.category}).`
      )
      return
    }
    if (
      item.status === 'Pending' &&
      batchInterventions.some(
        (currentItem) =>
          currentItem.type === item.type &&
          currentItem.asset === item.asset &&
          currentItem.status === 'Running'
      )
    ) {
      return
    }

    const nextStatus = item.status === 'Pending' ? 'Running' : 'Complete'
    const nowIso = new Date().toISOString()
    const startedAt = nextStatus === 'Running' ? nowIso : item.startedAt || nowIso
    const completedAt = nextStatus === 'Complete' ? nowIso : null
    const duration =
      nextStatus === 'Complete' ? formatDuration(startedAt, completedAt) : ''
    const isLocked = nextStatus === 'Complete'

    setInterventions((currentItems) =>
      currentItems.map((currentItem) =>
        currentItem.id === item.id
          ? {
              ...currentItem,
              status: nextStatus,
              operator: loginId,
              time: nowIso,
              startedAt,
              completedAt,
              duration,
              isLocked
            }
          : currentItem
      )
    )

    // Save Event + Duration Lock to SQL Server (AVI_IRS_DATA -> dbo.Events)
    await fetch('http://' + '127.0.0.1' + ':5000/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: item.id,
        code: item.code,
        batchId: item.batchId,
        type: item.type,
        asset: item.asset,
        activity: item.activity,
        category: item.category,
        status: nextStatus,
        operator: loginId
      })
    }).catch(() => {})

    const auditDetails = isLocked
      ? `${item.asset} · ${item.activity} · Duration: ${duration} (🔒 Locked)`
      : `${item.asset} · ${item.activity} · ${item.category}`

    recordAudit(
      nextStatus === 'Running' ? 'Intervention started' : 'Intervention completed',
      auditDetails
    )
  }

    const acknowledgeAlarm = async (alarmId) => {
    if (!hasRight('alarms', 'operate') && !hasRight('alarms', 'approve')) {
      alert('🔒 Locked: Your group does not have Operate permission for Alarms.')
      return
    }
    const alarm = alarms.find((item) => item.id === alarmId)
    if (!alarm || alarm.acknowledgedAt) return
    const acknowledgedAt = new Date().toISOString()

    setAlarms((currentAlarms) =>
      currentAlarms.map((currentAlarm) =>
        currentAlarm.id === alarmId
          ? {
              ...currentAlarm,
              acknowledged: true,
              acknowledgedBy: loginId,
              acknowledgedAt
            }
          : currentAlarm
      )
    )

    // Save Acknowledgment to SQL Server (AVI_IRS_DATA -> dbo.Alarms)
    await fetch('http://' + '127.0.0.1' + ':5000/api/alarms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: alarm.id,
        batchId: alarm.batchId || selectedBatchId,
        severity: alarm.severity,
        source: alarm.source,
        message: alarm.message,
        acknowledged: true,
        acknowledgedBy: loginId,
        deactivated: Boolean(alarm.deactivatedAt)
      })
    }).catch(() => {})

    recordAudit('Alarm acknowledged', `${alarm.id} · ${alarm.message}`)
  }

  const deactivateAlarm = async (alarmId) => {
    if (!hasRight('alarms', 'operate') && !hasRight('alarms', 'approve')) {
      alert('🔒 Locked: Your group does not have Operate permission for Alarms.')
      return
    }
    const alarm = alarms.find((item) => item.id === alarmId)
    if (!alarm || alarm.deactivatedAt) return
    const deactivatedAt = new Date().toISOString()
    const lockedDuration = formatDuration(alarm.activeAt, deactivatedAt)

    setAlarms((currentAlarms) =>
      currentAlarms.map((currentAlarm) =>
        currentAlarm.id === alarmId
          ? { ...currentAlarm, deactivatedAt, isLocked: true }
          : currentAlarm
      )
    )

    // Save Deactivation & Lock Duration in SQL Server (AVI_IRS_DATA -> dbo.Alarms)
    await fetch('http://' + '127.0.0.1' + ':5000/api/alarms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: alarm.id,
        batchId: alarm.batchId || selectedBatchId,
        severity: alarm.severity,
        source: alarm.source,
        message: alarm.message,
        acknowledged: Boolean(alarm.acknowledgedAt),
        acknowledgedBy: alarm.acknowledgedBy || null,
        deactivated: true
      })
    }).catch(() => {})

    recordAudit(
      'Alarm deactivated',
      `${alarm.id} · ${alarm.message} · Duration: ${lockedDuration} (🔒 Locked)`
    )
  }

  const exportReport = (reportType) => {
    const requiredModule = reportType === 'audit' ? 'audit' : 'reports'
    if (!hasRight(requiredModule, 'operate') && !hasRight(requiredModule, 'approve')) {
      alert(`🔒 Locked: Your group does not have Operate/Approve permission to export ${reportType} reports.`)
      return
    }

    let reportRows

    if (reportType === 'audit') {
      reportRows = [
        ['Date and time', 'Action / Activity', 'Description', 'User ID', 'Complete Name'],
        ...batchAuditEntries.map((entry) => [
          formatDateTime(entry.time),
          entry.action,
          entry.details,
          entry.user,
          users.find((user) => user.loginId === entry.user)?.name || entry.user
        ])
      ]
    } else if (reportType === 'alarm') {
      reportRows = [
        [
          'Alarm ID',
          'Severity',
          'Source',
          'Description',
          'Active date/time',
          'Deactive date/time',
          'Duration',
          'Acknowledge time',
          'Acknowledge user ID'
        ],
        ...batchAlarms.map((alarm) => [
          alarm.id,
          alarm.severity,
          alarm.source,
          alarm.message,
          formatDateTime(alarm.activeAt),
          alarm.deactivatedAt ? formatDateTime(alarm.deactivatedAt) : '',
          formatDuration(alarm.activeAt, alarm.deactivatedAt || Date.now()),
          alarm.acknowledgedAt ? formatDateTime(alarm.acknowledgedAt) : '',
          alarm.acknowledgedBy
        ])
      ]
    } else {
      reportRows = [
        [
          'Batch',
          'Activity code',
          'Asset',
          'Intervention type',
          'Action / Activity',
          'Classification',
          'Status',
          'Date and time',
          'User ID'
        ],
        ...batchInterventions.map((item) => [
          selectedBatchId,
          item.code,
          item.asset,
          item.type,
          item.activity,
          item.category,
          item.status,
          item.time ? formatDateTime(item.time) : '',
          item.operator
        ])
      ]
    }
    const csv = reportRows
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\r\n')
    const reportUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = reportUrl
    link.download = `${selectedBatchId}-${reportType}-report.csv`
    link.click()
    URL.revokeObjectURL(reportUrl)
    recordAudit('Report exported', `${selectedBatchId} · ${reportType} report`)
  }

  return (
    <section className="operations-view" aria-label="Operations dashboard">
      <div className="dashboard-statusbar">
        <div>
          <span>ACTIVE BATCH</span>
          <strong>{selectedBatch.id}</strong>
        </div>
        <label className="batch-picker">
          Batch
          <select
            aria-label="Active batch"
            onChange={(event) => selectBatch(event.target.value)}
            value={selectedBatchId}
          >
            {batchList.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.id} · {batch.product}
              </option>
            ))}
          </select>
        </label>
        <div>
          <span>USER</span>
          <strong>{loginId} ({userGroup})</strong>
        </div>
        <div>
          <span>SESSION STATUS</span>
          <strong>
            <i /> ACTIVE
          </strong>
        </div>
        <button className="dashboard-signout" type="button" onClick={onSignOut}>
          SIGN OUT
        </button>
      </div>

      <nav className="operations-tabs" role="tablist" aria-label="Operations sections">
        {operationTabs.map((tab) => {
          const access = getTabAccess(tab.id)
          const isDisabled = access === 'disabled'
          const isViewOnlyLocked = access === 'locked'

          return (
            <button
              aria-controls={`panel-${tab.id}`}
              aria-selected={effectiveTab === tab.id}
              className={effectiveTab === tab.id ? 'operations-tab is-active' : 'operations-tab'}
              disabled={isDisabled}
              id={`tab-${tab.id}`}
              key={tab.id}
              onClick={() => {
                if (!isDisabled) setActiveTab(tab.id)
              }}
              role="tab"
              style={isDisabled ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}
              title={
                isDisabled
                  ? 'Access Denied (View permission required)'
                  : isViewOnlyLocked
                    ? 'View-Only Mode (Operate & Approve locked)'
                    : tab.label
              }
              type="button"
            >
              {tab.label}
              {isViewOnlyLocked && (
                <span aria-label="View only locked" style={{ marginLeft: '6px', fontSize: '11px' }}>
                  🔒
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div
        aria-labelledby={`tab-${effectiveTab}`}
        className="operations-panel"
        id={`panel-${effectiveTab}`}
        role="tabpanel"
        tabIndex={0}
      >
        {getTabAccess(effectiveTab) === 'locked' && (
          <div
            style={{
              padding: '8px 14px',
              marginBottom: '12px',
              background: '#451a03',
              border: '1px solid #f59e0b',
              color: '#fef3c7',
              borderRadius: '4px',
              fontSize: '12.5px'
            }}
          >
            🔒 <strong>View-Only Mode:</strong> Your group ({userGroup}) can view this screen, but Operate and Approve actions are locked.
          </div>
        )}
        {effectiveTab === 'batch' && (
          <BatchControl
            batches={batchList}
            onCreateBatch={createBatch}
            onSelectBatch={selectBatch}
            onStartBatch={startBatch}
            onStopBatch={stopBatch}
            parentMessage={batchMessage}
            selectedBatch={selectedBatch}
          />
        )}

        {/* ✅ PASTE THIS RIGHT AFTER BATCH CONTROL */}
        {effectiveTab === 'fingerprint' && <FingerScanner />}


        {effectiveTab === 'overview' && (
          <>
            <div className="panel-heading">
              <div>
                <span>
                  {selectedBatch.product} / {selectedBatch.id}
                </span>
                <h1>Batch intervention overview</h1>
              </div>
              <span className="status-chip is-running">
                <i /> LIVE BATCH SUMMARY
              </span>
            </div>
            <div className="batch-metrics">
              <article>
                <span>DOOR ACTIVITIES</span>
                <strong>
                  {completedDoorCount}
                  <small> / {batchDoorInterventions.length}</small>
                </strong>
                <div className="metric-track">
                  <i
                    style={{
                      width: `${batchDoorInterventions.length ? (completedDoorCount / batchDoorInterventions.length) * 100 : 0}%`
                    }}
                  />
                </div>
                <em>{selectedBatch.doors.length} doors · 12 each</em>
              </article>
              <article>
                <span>GLOVE ACTIVITIES</span>
                <strong>
                  {completedGloveCount}
                  <small> / {batchGloveInterventions.length}</small>
                </strong>
                <div className="metric-track">
                  <i
                    style={{
                      width: `${batchGloveInterventions.length ? (completedGloveCount / batchGloveInterventions.length) * 100 : 0}%`
                    }}
                  />
                </div>
                <em>{selectedBatch.gloves.length} glove ports · 12 each</em>
              </article>
              <article>
                <span>RUNNING NOW</span>
                <strong>{runningCount}</strong>
                <em>Interventions in progress</em>
              </article>
              <article>
                <span>UNACKNOWLEDGED ALARMS</span>
                <strong>{pendingAlarmCount}</strong>
                <em>For selected batch</em>
              </article>
            </div>
            <div className="batch-asset-grid">
              <section className="batch-asset-panel">
                <h2>Door intervention counts</h2>
                {selectedBatch.doors.map((asset) => {
                  const records = batchDoorInterventions.filter((item) => item.asset === asset)
                  const complete = records.filter((item) => item.status === 'Complete').length
                  const running = records.filter((item) => item.status === 'Running').length
                  return (
                    <div className="asset-count-row" key={asset}>
                      <strong>{asset}</strong>
                      <span>
                        {running ? `${running} running · ` : ''}
                        {complete} / {records.length} complete
                      </span>
                      <i>
                        <b style={{ width: `${(complete / records.length) * 100}%` }} />
                      </i>
                    </div>
                  )
                })}
              </section>
              <section className="batch-asset-panel">
                <h2>Glove intervention counts</h2>
                {selectedBatch.gloves.map((asset) => {
                  const records = batchGloveInterventions.filter((item) => item.asset === asset)
                  const complete = records.filter((item) => item.status === 'Complete').length
                  const running = records.filter((item) => item.status === 'Running').length
                  return (
                    <div className="asset-count-row" key={asset}>
                      <strong>{asset}</strong>
                      <span>
                        {running ? `${running} running · ` : ''}
                        {complete} / {records.length} complete
                      </span>
                      <i>
                        <b style={{ width: `${(complete / records.length) * 100}%` }} />
                      </i>
                    </div>
                  )
                })}
              </section>
            </div>
            <p className="data-note">
              Sample batch records · counts update as activities are started and completed.
            </p>
          </>
        )}

        {effectiveTab === 'door' && (
          <>
            <div className="panel-heading">
              <div>
                <span>INTERVENTION / {selectedBatch.id}</span>
                <h1>Door activities</h1>
              </div>
              <span className="status-chip is-running">
                <i /> {selectedBatch.doors.length} DOORS
              </span>
            </div>
            <div className="asset-toolbar">
              <label>
                Select door
                <select
                  aria-label="Selected door"
                  onChange={(event) => setSelectedDoor(event.target.value)}
                  value={selectedDoor}
                >
                  {selectedBatch.doors.map((asset) => (
                    <option key={asset}>{asset}</option>
                  ))}
                </select>
              </label>
              <span>
                {
                  batchDoorInterventions.filter(
                    (item) => item.asset === selectedDoor && item.status === 'Complete'
                  ).length
                }{' '}
                / {doorActivities.length} activities complete
              </span>
            </div>
            <div className="activity-list">
              {batchDoorInterventions
                .filter((item) => item.asset === selectedDoor)
                .map((item) => {
                  const requiredAction = item.category === 'Verification' ? 'approve' : 'operate'
                  const canPerform = hasRight('door', requiredAction)
                  const anotherRunning =
                    item.status === 'Pending' &&
                    batchDoorInterventions.some(
                      (currentItem) =>
                        currentItem.asset === item.asset && currentItem.status === 'Running'
                    )

                  return (
                    <article className={`activity-row is-${item.status.toLowerCase()}`} key={item.id}>
                      <span className="activity-index" title={`Activity code ${item.code}`}>
                        {item.code}
                      </span>
                      <div className="activity-copy">
                        <div>
                          <strong>{item.activity}</strong>
                          <span className={`activity-category is-${item.category.toLowerCase()}`}>
                            {item.category}
                          </span>
                        </div>
                        <small>
                          {item.status === 'Pending'
                            ? 'Not started'
                            : `${item.status} by ${item.operator} · ${item.time}`}
                        </small>
                      </div>
                      {item.status === 'Running' && (
                        <span className="running-dancer" aria-label="Activity running">
                          <i />
                          <i />
                          <i />
                        </span>
                      )}
                      <span className={`activity-status is-${item.status.toLowerCase()}`}>
                        <i />
                        {item.status}
                      </span>
                      {item.status !== 'Complete' && (
                        <button
                          className="activity-action"
                          disabled={!canPerform || anotherRunning}
                          onClick={() => updateIntervention(item)}
                          title={
                            !canPerform
                              ? `Locked: Requires ${requiredAction.toUpperCase()} permission`
                              : undefined
                          }
                          type="button"
                        >
                          {!canPerform ? '🔒 ' : ''}
                          {item.status === 'Running' ? 'MARK COMPLETE' : 'START'}
                        </button>
                      )}
                    </article>
                  )
                })}
            </div>
          </>
        )}

        {effectiveTab === 'glove' && (
          <>
            <div className="panel-heading">
              <div>
                <span>INTERVENTION / {selectedBatch.id}</span>
                <h1>Glove activities</h1>
              </div>
              <span className="status-chip is-running">
                <i /> {selectedBatch.gloves.length} GLOVE PORTS
              </span>
            </div>
            <div className="asset-toolbar">
              <label>
                Select glove port
                <select
                  aria-label="Selected glove port"
                  onChange={(event) => setSelectedGlove(event.target.value)}
                  value={selectedGlove}
                >
                  {selectedBatch.gloves.map((asset) => (
                    <option key={asset}>{asset}</option>
                  ))}
                </select>
              </label>
              <span>
                {
                  batchGloveInterventions.filter(
                    (item) => item.asset === selectedGlove && item.status === 'Complete'
                  ).length
                }{' '}
                / {gloveActivities.length} activities complete
              </span>
            </div>
            <div className="activity-list">
              {batchGloveInterventions
                .filter((item) => item.asset === selectedGlove)
                .map((item) => {
                  const requiredAction = item.category === 'Verification' ? 'approve' : 'operate'
                  const canPerform = hasRight('glove', requiredAction)
                  const anotherRunning =
                    item.status === 'Pending' &&
                    batchGloveInterventions.some(
                      (currentItem) =>
                        currentItem.asset === item.asset && currentItem.status === 'Running'
                    )

                  return (
                    <article className={`activity-row is-${item.status.toLowerCase()}`} key={item.id}>
                      <span className="activity-index" title={`Activity code ${item.code}`}>
                        {item.code}
                      </span>
                      <div className="activity-copy">
                        <div>
                          <strong>{item.activity}</strong>
                          <span className={`activity-category is-${item.category.toLowerCase()}`}>
                            {item.category}
                          </span>
                        </div>
                        <small>
                          {item.status === 'Pending'
                            ? 'Not started'
                            : `${item.status} by ${item.operator} · ${item.time}`}
                        </small>
                      </div>
                      {item.status === 'Running' && (
                        <span className="running-dancer" aria-label="Activity running">
                          <i />
                          <i />
                          <i />
                        </span>
                      )}
                      <span className={`activity-status is-${item.status.toLowerCase()}`}>
                        <i />
                        {item.status}
                      </span>
                      {item.status !== 'Complete' && (
                        <button
                          className="activity-action"
                          disabled={!canPerform || anotherRunning}
                          onClick={() => updateIntervention(item)}
                          title={
                            !canPerform
                              ? `Locked: Requires ${requiredAction.toUpperCase()} permission`
                              : undefined
                          }
                          type="button"
                        >
                          {!canPerform ? '🔒 ' : ''}
                          {item.status === 'Running' ? 'MARK COMPLETE' : 'START'}
                        </button>
                      )}
                    </article>
                  )
                })}
            </div>
          </>
        )}

        {effectiveTab === 'alarms' && (
          <Alarms
            alarms={batchAlarms}
            onAcknowledge={acknowledgeAlarm}
            onDeactivate={deactivateAlarm}
          />
        )}

        {effectiveTab === 'reports' && (
          <Reports
            alarms={batchAlarms}
            auditEntries={batchAuditEntries}
            batch={selectedBatch}
            interventions={batchInterventions}
            onExportReport={exportReport}
            users={users}
          />
        )}

        {effectiveTab === 'trend' && (
          <>
            <div className="panel-heading">
              <div>
                <span>INTERVENTION TREND / {selectedBatch.id}</span>
                <h1>Batch intervention trend</h1>
              </div>
              <span className="status-chip is-running">
                <i /> LOCAL ACTIVITY
              </span>
            </div>
            <div className="trend-summary-cards">
              <article>
                <span>DOOR COMPLETIONS</span>
                <strong>
                  {completedDoorCount}
                  <small> / {batchDoorInterventions.length}</small>
                </strong>
              </article>
              <article>
                <span>GLOVE COMPLETIONS</span>
                <strong>
                  {completedGloveCount}
                  <small> / {batchGloveInterventions.length}</small>
                </strong>
              </article>
              <article>
                <span>RUNNING</span>
                <strong>{runningCount}</strong>
              </article>
            </div>
            <section className="batch-trend-chart" aria-label="Completed interventions by asset">
              {[
                ...selectedBatch.doors.map((asset) => ({
                  asset,
                  type: 'door',
                  records: batchDoorInterventions
                })),
                ...selectedBatch.gloves.map((asset) => ({
                  asset,
                  type: 'glove',
                  records: batchGloveInterventions
                }))
              ].map((item) => {
                const assetRecords = item.records.filter((record) => record.asset === item.asset)
                const complete = assetRecords.filter(
                  (record) => record.status === 'Complete'
                ).length
                const running = assetRecords.filter((record) => record.status === 'Running').length
                return (
                  <div className="trend-asset-row" key={item.asset}>
                    <span>{item.asset}</span>
                    <div className="trend-track">
                      <i
                        className={`trend-fill is-${item.type}`}
                        style={{ width: `${(complete / assetRecords.length) * 100}%` }}
                      />
                      {running > 0 && (
                        <i
                          className="trend-running"
                          style={{ width: `${(running / assetRecords.length) * 100}%` }}
                        />
                      )}
                    </div>
                    <strong>
                      {complete} / {assetRecords.length}
                    </strong>
                  </div>
                )
              })}
            </section>
            <p className="data-note">
              Trend counts are calculated from the selected batch. No equipment telemetry is
              connected.
            </p>
          </>
        )}

        {effectiveTab === 'audit' && (
          <Audit
            auditEntries={batchAuditEntries}
            batchId={selectedBatch.id}
            canExport={hasRight('audit', 'operate') || hasRight('audit', 'approve')}
            onAuditExported={recordAudit}
            users={users}
          />
        )}

        {effectiveTab === 'users' && (
          <Management
            currentUser={{ loginId }}
            sqlInfo={sqlInfo}
            groups={groups}
            managementMessage={managementMessage}
            onActivateUser={onActivateUser}
            onAddGroup={onAddGroup}
            onAddUser={onAddUser}
            onRemoveGroup={onRemoveGroup}
            onRemoveUser={onRemoveUser}
            onSelectRightsGroup={onSelectRightsGroup}
            onToggleRight={onToggleRight}
            onUnlockUser={onUnlockUser}
            onUpdateUserGroup={onUpdateUserGroup}
            rights={rights}
            selectedRightsGroup={selectedRightsGroup}
            users={users}
          />
        )}


      </div>

      <Footer batchNumber={selectedBatch.id} userId={loginId} />
    </section>
  )
}

OperationsDashboard.propTypes = {
  alarms: PropTypes.arrayOf(PropTypes.object).isRequired,
  loginId: PropTypes.string.isRequired,
  onSignOut: PropTypes.func.isRequired,
  setAlarms: PropTypes.func.isRequired,
  sqlInfo: PropTypes.object,
  users: PropTypes.arrayOf(PropTypes.object).isRequired,
  groups: PropTypes.arrayOf(PropTypes.string).isRequired,
  rights: PropTypes.object.isRequired,
  selectedRightsGroup: PropTypes.string.isRequired,
  managementMessage: PropTypes.string,
  onAddUser: PropTypes.func.isRequired,
  onRemoveUser: PropTypes.func.isRequired,
  onUpdateUserGroup: PropTypes.func.isRequired,
  onAddGroup: PropTypes.func.isRequired,
  onToggleRight: PropTypes.func.isRequired,
  onSelectRightsGroup: PropTypes.func.isRequired
}

export default Welcome
