import { useState, useEffect } from 'react'
import Login from './components/01_Login'
import Welcome from './components/02_Welcome'
import Management from './components/03_Management'

const API_URL = 'http://' + '127.0.0.1' + ':5000/api'

function App() {
  const [currentScreen, setCurrentScreen] = useState('login')
  const [loggedInUser, setLoggedInUser] = useState(null)

  // Management & Database metadata states (AVI_IRS_UM)
  const [users, setUsers] = useState([])
  const [groups, setGroups] = useState([])
  const [rights, setRights] = useState({})
  const [selectedRightsGroup, setSelectedRightsGroup] = useState('')
  const [managementMessage, setManagementMessage] = useState('')
  const [sqlInfo, setSqlInfo] = useState(null)

  const logAuditEvent = async (action, details, actor = loggedInUser) => {
    const actorId = actor?.loginId || 'Admin'
    const actorName = actor?.name || actorId
    try {
      await fetch(`${API_URL}/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId: 'SYSTEM',
          user: actorId,
          completeName: actorName,
          action,
          details
        })
      })
    } catch (err) {
      console.error('Audit Log Failed:', err)
    }
  }

  const loadData = async () => {
    try {
      const res = await fetch(`${API_URL}/management`)
      const data = await res.json()
      if (!res.ok) return
      setUsers(data.users || [])
      setGroups(data.groups || [])
      setRights(data.rights || {})
      if (data.sqlInfo) {
        setSqlInfo(data.sqlInfo)
        setManagementMessage(
          `Connected: ${data.sqlInfo.database} » ${data.sqlInfo.tables.join(', ')}`
        )
      }
      if (!selectedRightsGroup && data.groups?.length) {
        setSelectedRightsGroup(data.groups.at(0))
      }
    } catch (err) {
      console.error('Failed To Load Management Data:', err)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleAddUser = async (user) => {
    if (!user.group || !String(user.group).trim()) {
      alert('Cannot create user without assigning a Group.')
      return false
    }

    const res = await fetch(`${API_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    })
    const data = await res.json()
    if (!res.ok) {
      alert(data.error || 'Could not create user.')
      return false
    }
    await loadData()
    await logAuditEvent(
      'User Created',
      `Created User: ${user.loginId} · EmpID: ${user.employeeId} · ${user.name} (${user.group})`
    )
    return true
  }

  const handleRemoveUser = async (loginId) => {
    if (String(loginId).toLowerCase() === 'admin') {
      alert('Admin account cannot be deleted or deactivated.')
      return
    }
    if (
      loggedInUser?.loginId &&
      String(loginId).toLowerCase() === String(loggedInUser.loginId).toLowerCase()
    ) {
      alert('You cannot deactivate your own logged-in user account.')
      return
    }

    const targetUser = users.find((u) => u.loginId === loginId)
    const userGroup = targetUser?.group || 'Unassigned'

    const res = await fetch(`${API_URL}/users/${loginId}`, {
      method: 'DELETE',
      headers: { 'x-actor-id': loggedInUser?.loginId || '' }
    })
    const data = await res.json()
    if (!res.ok) {
      alert(data.error || 'Unable to deactivate user.')
      return
    }

    await loadData()
    await logAuditEvent(
      'User Deactivated',
      `Deactivated User Account: ${loginId} (${userGroup})`
    )
    alert(`User Account "${loginId}" has been deactivated.`)
  }

  const handleActivateUser = async (loginId) => {
    const targetUser = users.find((u) => u.loginId === loginId)
    const userGroup = targetUser?.group || 'Unassigned'

    await fetch(`${API_URL}/users/${loginId}/activate`, { method: 'PUT' })
    await loadData()
    await logAuditEvent(
      'User Activated',
      `Activated User Account: ${loginId} (${userGroup})`
    )
    alert(`User Account "${loginId}" has been activated.`)
  }

  const handleUnlockUser = async (loginId) => {
    const targetUser = users.find((u) => u.loginId === loginId)
    const userGroup = targetUser?.group || 'Unassigned'

    await fetch(`${API_URL}/users/${loginId}/unlock`, { method: 'PUT' })
    await loadData()
    await logAuditEvent(
      'User Unlocked',
      `Unlocked User Account: ${loginId} (${userGroup})`
    )
    alert(`User Account "${loginId}" has been unlocked.`)
  }

  const handleUpdateUserGroup = async (loginId, group) => {
    if (String(loginId).toLowerCase() === 'admin' && group !== 'Administrators') {
      alert('Admin account cannot be removed from the Administrators group.')
      return
    }

    const previousGroup =
      users.find((u) => u.loginId === loginId)?.group || 'Unassigned'

    const res = await fetch(`${API_URL}/users/${loginId}/group`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group })
    })
    const data = await res.json()
    if (!res.ok) {
      alert(data.error || 'Unable to update user group.')
      return
    }

    await loadData()
    await logAuditEvent(
      'User Group Updated',
      `Updated User Group: ${loginId} (${previousGroup} -> ${group})`
    )
  }

  const handleAddGroup = async (groupName) => {
    const res = await fetch(`${API_URL}/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupName })
    })
    const data = await res.json()
    if (!res.ok) {
      const friendlyMsg = data.error || 'Could Not Create Group.'
      alert(friendlyMsg)
      return false
    }
    await loadData()
    await logAuditEvent(
      'User Group Created',
      `Created User Group: (${groupName})`
    )
    return true
  }

  const handleRemoveGroup = async (groupName) => {
    if (String(groupName).toLowerCase() === 'administrators') {
      alert('Administrators group cannot be deleted or deactivated.')
      return
    }
    const res = await fetch(`${API_URL}/groups/${encodeURIComponent(groupName)}`, {
      method: 'DELETE'
    })
    const data = await res.json()
    if (!res.ok) {
      alert(data.error || 'Unable to remove group.')
      return
    }
    await loadData()
    await logAuditEvent('User Group Removed', `Removed User Group: (${groupName})`)
    alert(`Group "${groupName}" removed. Assigned users now have no group until reassigned.`)
  }

  const handleToggleRight = async (moduleId, actionId) => {
    const currentPermissions = rights[selectedRightsGroup]?.[moduleId] || {
      view: false,
      operate: false,
      approve: false
    }
    const nextState = !currentPermissions[actionId]
    const updatedPermissions = {
      ...currentPermissions,
      [actionId]: nextState
    }

    const res = await fetch(`${API_URL}/rights`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupName: selectedRightsGroup,
        moduleId,
        ...updatedPermissions
      })
    })
    await loadData()
    if (res.ok) {
      await logAuditEvent(
        'User Right Updated',
        `${selectedRightsGroup} · ${moduleId} · ${actionId.toUpperCase()} ${nextState ? 'Granted' : 'Revoked'}`
      )
    }
  }

  const handleLoginSuccess = async (user) => {
    setLoggedInUser(user)
    await logAuditEvent(
      'User Login',
      `User Login Successfully : ${user.loginId} (${user.group})`,
      user
    )
    await loadData()
    setCurrentScreen('welcome')
  }

  const handleLogout = async () => {
    if (loggedInUser) {
      await logAuditEvent(
        'User Logout',
        `User Logout Successfully : ${loggedInUser.loginId} (${loggedInUser.group})`,
        loggedInUser
      )
    }
    setLoggedInUser(null)
    setCurrentScreen('login')
  }

  return (
    <div>
      {currentScreen === 'login' && <Login onLoginSuccess={handleLoginSuccess} />}

      {currentScreen === 'welcome' && (
        <Welcome
          currentUser={loggedInUser}
          onLogout={handleLogout}
          onOpenManagement={() => setCurrentScreen('management')}
          sqlInfo={sqlInfo}
          users={users}
          groups={groups}
          rights={rights}
          selectedRightsGroup={selectedRightsGroup}
          managementMessage={managementMessage}
          onAddUser={handleAddUser}
          onRemoveUser={handleRemoveUser}
          onActivateUser={handleActivateUser}
          onUnlockUser={handleUnlockUser}
          onUpdateUserGroup={handleUpdateUserGroup}
          onAddGroup={handleAddGroup}
          onRemoveGroup={handleRemoveGroup}
          onToggleRight={handleToggleRight}
          onSelectRightsGroup={setSelectedRightsGroup}
        />
      )}

      {currentScreen === 'management' && (
        <Management
          currentUser={loggedInUser}
          sqlInfo={sqlInfo}
          users={users}
          groups={groups}
          rights={rights}
          selectedRightsGroup={selectedRightsGroup}
          managementMessage={managementMessage}
          onAddUser={handleAddUser}
          onRemoveUser={handleRemoveUser}
          onActivateUser={handleActivateUser}
          onUnlockUser={handleUnlockUser}
          onUpdateUserGroup={handleUpdateUserGroup}
          onAddGroup={handleAddGroup}
          onRemoveGroup={handleRemoveGroup}
          onToggleRight={handleToggleRight}
          onSelectRightsGroup={setSelectedRightsGroup}
          onBack={() => setCurrentScreen('welcome')}
        />
      )}
    </div>
  )
}

export default App

