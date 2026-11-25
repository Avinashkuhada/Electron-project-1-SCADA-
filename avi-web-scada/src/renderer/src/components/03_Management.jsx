import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'

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

const permissionActions = [
  { id: 'view', label: 'View' },
  { id: 'operate', label: 'Operate' },
  { id: 'approve', label: 'Approve' }
]

function Management({
  currentUser,
  sqlInfo,
  users,
  groups,
  rights,
  selectedRightsGroup,
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
  const [activeSection, setActiveSection] = useState('users')
  const [employeeId, setEmployeeId] = useState('')
  const [loginId, setLoginId] = useState('')
  const [completeName, setCompleteName] = useState('')
  const [password, setPassword] = useState('')
  const [group, setGroup] = useState(groups.at(0) || '')
  const [newGroupName, setNewGroupName] = useState('')

  useEffect(() => {
    if (!group && groups.length > 0) {
      setGroup(groups.at(0))
    }
  }, [groups, group])

  const submitUser = async (event) => {
    event.preventDefault()
    const user = {
      employeeId: employeeId.trim() || null,
      loginId: loginId.trim(),
      name: completeName.trim(),
      password,
      group
    }

    if (!user.loginId || !user.name || !user.password.trim() || !user.group) {
      alert('Login ID, Complete Name, Password, and Group are required.')
      return
    }

    const added = await onAddUser(user)
    if (added) {
      setEmployeeId('')
      setLoginId('')
      setCompleteName('')
      setPassword('')
    }
  }

  const submitGroup = async (event) => {
    event.preventDefault()
    const cleanGroup = newGroupName.trim()
    if (!cleanGroup) return
    const created = await onAddGroup(cleanGroup)
    if (created) setNewGroupName('')
  }

  return (
    <section className="professional-screen management-screen" aria-label="User management">
      <header className="screen-heading">
        <div>
          <span className="screen-eyebrow">ACCESS CONTROL / ADMINISTRATION</span>
          <h1>User management</h1>
          <p>Manage operator accounts, groups, and application rights.</p>
        </div>
        <span className="screen-mode-badge">
          {sqlInfo?.database ? `${sqlInfo.database} » CONNECTED` : 'AVI_IRS_UM » CONNECTED'}
        </span>
      </header>

      <nav className="management-sections" role="tablist" aria-label="User management sections">
        {[
          { id: 'users', label: 'Users' },
          { id: 'groups', label: 'Groups' },
          { id: 'rights', label: 'User Rights' }
        ].map((section) => (
          <button
            aria-selected={activeSection === section.id}
            className={
              activeSection === section.id
                ? 'management-section-tab is-active'
                : 'management-section-tab'
            }
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            role="tab"
            type="button"
          >
            {section.label}
          </button>
        ))}
      </nav>

      {activeSection === 'users' && (
        <div className="management-section-content">
                 <form
            className="user-create-form"
            onSubmit={submitUser}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'flex-end',
              gap: '10px',          // Horizontal (X) spacing between boxes
              marginTop: '8px'      // Vertical (Y) offset from tabs above
            }}
          >
            <label style={{ width: '150px' }}>
              Login ID
              <input
                autoComplete="off"
                onChange={(event) => setLoginId(event.target.value)}
                placeholder="Unique User ID"
                required
                style={{ width: '100%', height: '36px' }}
                value={loginId}
              />
            </label>

            <label style={{ width: '210px' }}>
              Complete Name
              <input
                autoComplete="name"
                onChange={(event) => setCompleteName(event.target.value)}
                placeholder="First and Last name"
                required
                style={{ width: '100%', height: '36px' }}
                value={completeName}
              />
            </label>

            <label style={{ width: '150px' }}>
              Password
              <input
                autoComplete="new-password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Set initial password"
                required
                type="password"
                style={{ width: '100%', height: '36px' }}
                value={password}
              />
            </label>

            <label style={{ width: '160px' }}>
              Group
              <select
                onChange={(event) => setGroup(event.target.value)}
                required
                style={{ width: '100%', height: '36px' }}
                value={group}
              >
                {groups.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ width: '150px' }}>
              Employee ID (Optional)
              <input
                autoComplete="off"
                onChange={(event) => setEmployeeId(event.target.value)}
                placeholder="Employee ID"
                style={{ width: '100%', height: '36px' }}
                value={employeeId}
              />
            </label>

            <button
              className="primary-screen-action"
              disabled={!groups.length}
              style={{ height: '36px' }}
              type="submit"
            >
              CREATE USER
            </button>
          </form>



          <div className="professional-table-wrap">
            <table className="professional-table user-record-table">
              <thead>
                <tr>
                  <th>Employee ID</th>
                  <th>Login ID</th>
                  <th>Complete Name</th>
                  <th>Group</th>
                  <th>Password Age</th>
                  <th>Account</th>
                  <th>Lock</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isAdmin = String(user.loginId).toLowerCase() === 'admin'
                  const isSelf =
                    currentUser?.loginId &&
                    String(user.loginId).toLowerCase() ===
                      String(currentUser.loginId).toLowerCase()
                  const isActive =
                    user.isActive !== undefined
                      ? Boolean(user.isActive)
                      : user.status !== 'Deactivated' && user.status !== 'Inactive'
                  const isLocked =
                    user.isLocked !== undefined
                      ? Boolean(user.isLocked)
                      : user.status === 'Locked'
                  const ageDays = Number(user.passwordAgeDays ?? 0)

                  return (
                    <tr key={user.loginId}>
                      <td title="View-only Employee ID (Cannot be used for login)">
                        {user.employeeId || '-'}
                      </td>
                      <td>{user.loginId}</td>
                      <td>{user.name}</td>
                      <td>
                        <select
                          aria-label={`Group for ${user.loginId}`}
                          disabled={isAdmin}
                          onChange={(event) => onUpdateUserGroup(user.loginId, event.target.value)}
                          value={user.group || ''}
                        >
                          {!user.group && <option value="">-- Unassigned --</option>}
                          {groups.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {ageDays} {ageDays === 1 ? 'day' : 'days'}
                      </td>
                      <td>
                        <span className={`record-status ${isActive ? 'is-complete' : 'is-stopped'}`}>
                          {isActive ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td>
                        <span className={`record-status ${isLocked ? 'is-stopped' : 'is-complete'}`}>
                          {isLocked ? 'Locked 🔒' : 'Unlocked'}
                        </span>
                      </td>
                      <td>
                        {isAdmin ? (
                          <span className="record-status is-complete">PROTECTED</span>
                        ) : (
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {isSelf ? (
                              <span className="record-status is-complete">CURRENT USER</span>
                            ) : isActive ? (
                              <button
                                className="table-action-danger"
                                onClick={() => onRemoveUser(user.loginId)}
                                type="button"
                              >
                                DEACTIVATE
                              </button>
                            ) : (
                              <button
                                className="primary-screen-action"
                                onClick={() => onActivateUser && onActivateUser(user.loginId)}
                                type="button"
                              >
                                ACTIVATE
                              </button>
                            )}

                            {isLocked && (
                              <button
                                className="primary-screen-action"
                                onClick={() => onUnlockUser && onUnlockUser(user.loginId)}
                                type="button"
                              >
                                UNLOCK
                              </button>
                                                          )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="screen-disclaimer">
            Connected: AVI_IRS_UM » dbo.Users. Passwords are encrypted and stored securely.
          </p>
        </div>
      )}

      {activeSection === 'groups' && (
        <div className="management-section-content">
          <form className="group-create-form" onSubmit={submitGroup}>
            <label>
              New group name
              <input
                onChange={(event) => setNewGroupName(event.target.value)}
                placeholder="e.g. Shift Supervisors"
                required
                value={newGroupName}
              />
            </label>
            <button className="primary-screen-action" type="submit">
              CREATE GROUP
            </button>
          </form>

          <div className="management-group-list">
            {groups.map((item) => {
              const isProtectedGroup = String(item).toLowerCase() === 'administrators'
              return (
                <article className="management-group-row" key={item}>
                  <div>
                    <strong>
                      {item} {isProtectedGroup ? '🔒' : ''}
                    </strong>
                    <span>{users.filter((user) => user.group === item).length} assigned users</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      className="table-action-neutral"
                      onClick={() => {
                        onSelectRightsGroup(item)
                        setActiveSection('rights')
                      }}
                      type="button"
                    >
                      CONFIGURE RIGHTS
                    </button>
                    {!isProtectedGroup && onRemoveGroup && (
                      <button
                        className="table-action-danger"
                        onClick={() => onRemoveGroup(item)}
                        type="button"
                      >
                        REMOVE
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
          <p className="screen-disclaimer">Connected: AVI_IRS_UM » dbo.Groups.</p>
        </div>
      )}

      {activeSection === 'rights' && (
        <div className="management-section-content">
          <label className="rights-group-picker">
            Rights for group
            <select
              onChange={(event) => onSelectRightsGroup(event.target.value)}
              value={selectedRightsGroup}
            >
              {groups.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <div className="professional-table-wrap">
            <table className="professional-table rights-record-table">
              <thead>
                <tr>
                  <th>Module</th>
                  {permissionActions.map((action) => (
                    <th key={action.id}>{action.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissionModules.map((module) => {
                  const permissions = rights[selectedRightsGroup]?.[module.id] || {
                    view: false,
                    operate: false,
                    approve: false
                  }
                  const isAdminUsersLock =
                    String(selectedRightsGroup).toLowerCase() === 'administrators' &&
                    module.id === 'users'

                  return (
                    <tr key={module.id}>
                      <td>{module.label}</td>
                      {permissionActions.map((action) => (
                        <td key={action.id}>
                          <input
                            aria-label={`${action.label} ${module.label} for ${selectedRightsGroup}`}
                            checked={Boolean(permissions[action.id])}
                            disabled={isAdminUsersLock}
                            onChange={() => onToggleRight(module.id, action.id)}
                            type="checkbox"
                          />
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="screen-disclaimer">
            Connected: AVI_IRS_UM » dbo.GroupRights. Rights changes are saved automatically.
          </p>
        </div>
      )}
    </section>
  )
}

Management.propTypes = {
  currentUser: PropTypes.object,
  sqlInfo: PropTypes.object,
  users: PropTypes.arrayOf(PropTypes.object).isRequired,
  groups: PropTypes.arrayOf(PropTypes.string).isRequired,
  rights: PropTypes.objectOf(PropTypes.object).isRequired,
  selectedRightsGroup: PropTypes.string.isRequired,
  onAddUser: PropTypes.func.isRequired,
  onRemoveUser: PropTypes.func.isRequired,
  onActivateUser: PropTypes.func,
  onUnlockUser: PropTypes.func,
  onUpdateUserGroup: PropTypes.func.isRequired,
  onAddGroup: PropTypes.func.isRequired,
  onRemoveGroup: PropTypes.func,
  onToggleRight: PropTypes.func.isRequired,
  onSelectRightsGroup: PropTypes.func.isRequired
}

export default Management

