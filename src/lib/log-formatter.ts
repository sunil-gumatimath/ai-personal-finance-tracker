import type { LogEntry } from '@/pages/SystemLogs'

export function formatAction(action: string): string {
  const actionMap: Record<string, string> = {
    TRANSACTION_CREATED: 'Transaction Created',
    TRANSACTION_EDITED: 'Transaction Edited',
    TRANSACTION_DELETED: 'Transaction Deleted',
  }
  return actionMap[action] || action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function formatResource(resource: string): { type: string; id: string; short: string } {
  const parts = resource.split('/')
  const type = parts[0] || resource
  const id = parts[1] || ''
  const short = id ? `${type}#${id.slice(0, 8)}...` : type
  return { type, id, short }
}

export function formatTimestamp(timestamp: string): { absolute: string; relative: string } {
  const date = new Date(timestamp)
  const absolute = date.toLocaleString()
  
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  let relative: string
  if (diffSec < 60) relative = 'just now'
  else if (diffMin < 60) relative = `${diffMin}m ago`
  else if (diffHr < 24) relative = `${diffHr}h ago`
  else if (diffDay < 7) relative = `${diffDay}d ago`
  else relative = date.toLocaleDateString()

  return { absolute, relative }
}

export function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num)) return String(amount)
  return `$${num.toFixed(2)}`
}

export function formatFieldName(field: string): string {
  const fieldMap: Record<string, string> = {
    amount: 'Amount',
    description: 'Description',
    notes: 'Notes',
    date: 'Date',
    type: 'Type',
    is_recurring: 'Recurring',
    recurring_frequency: 'Frequency',
    category_id: 'Category',
    account_id: 'Account',
    to_account_id: 'Transfer To',
    updated_at: 'Updated At',
    created_at: 'Created At',
    user_id: 'User',
    id: 'ID',
  }
  return fieldMap[field] || field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function shouldShowField(field: string): boolean {
  const hiddenFields = ['id', 'user_id', 'created_at']
  return !hiddenFields.includes(field)
}

export function formatFieldValue(field: string, value: any): string {
  if (value === null || value === undefined) return 'None'
  
  if (field === 'amount') return formatCurrency(value)
  if (field === 'date') return new Date(value).toLocaleDateString()
  if (field === 'updated_at' || field === 'created_at') return new Date(value).toLocaleString()
  if (field === 'type') return value.charAt(0).toUpperCase() + value.slice(1)
  if (field === 'is_recurring') return value ? 'Yes' : 'No'
  if (field === 'description' || field === 'notes') return value || 'None'
  
  return String(value)
}

export function generateHumanDescription(log: LogEntry): string {
  const resource = formatResource(log.resource)
  const action = formatAction(log.action)
  const user = log.userEmail || 'System'
  
  if (log.action === 'TRANSACTION_CREATED') {
    const newValue = log.newValue ? JSON.parse(log.newValue) : null
    const amount = newValue?.amount ? formatCurrency(newValue.amount) : 'unknown amount'
    const desc = newValue?.description || 'no description'
    return `${user} created ${resource.type} - ${amount} (${desc})`
  }
  
  if (log.action === 'TRANSACTION_DELETED') {
    const oldValue = log.oldValue ? JSON.parse(log.oldValue) : null
    const amount = oldValue?.amount ? formatCurrency(oldValue.amount) : 'unknown amount'
    const desc = oldValue?.description || 'no description'
    return `${user} deleted ${resource.type} - ${amount} (${desc})`
  }
  
  if (log.action === 'TRANSACTION_EDITED') {
    const changes = getFieldChanges(log.oldValue, log.newValue)
    const changeSummary = changes.slice(0, 2).map(c => c.summary).join(', ')
    const more = changes.length > 2 ? ` and ${changes.length - 2} more` : ''
    return `${user} edited ${resource.type} - ${changeSummary}${more}`
  }
  
  return `${user} ${action.toLowerCase()} ${resource.short}`
}

interface FieldChange {
  field: string
  oldValue: any
  newValue: any
  summary: string
}

export function getFieldChanges(oldValue: string | null, newValue: string | null): FieldChange[] {
  if (!oldValue || !newValue) return []
  
  try {
    const oldObj = typeof oldValue === 'string' ? JSON.parse(oldValue) : oldValue
    const newObj = typeof newValue === 'string' ? JSON.parse(newValue) : newValue
    
    const changes: FieldChange[] = []
    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)])
    
    for (const key of allKeys) {
      if (!shouldShowField(key)) continue
      
      const oldVal = oldObj[key]
      const newVal = newObj[key]
      
      if (oldVal !== newVal) {
        const fieldName = formatFieldName(key)
        const oldFormatted = formatFieldValue(key, oldVal)
        const newFormatted = formatFieldValue(key, newVal)
        
        let summary: string
        if (oldVal === null || oldVal === undefined) {
          summary = `${fieldName} set to ${newFormatted}`
        } else if (newVal === null || newVal === undefined) {
          summary = `${fieldName} removed`
        } else {
          summary = `${fieldName}: ${oldFormatted} → ${newFormatted}`
        }
        
        changes.push({
          field: key,
          oldValue: oldVal,
          newValue: newVal,
          summary,
        })
      }
    }
    
    return changes
  } catch {
    return []
  }
}

export function formatMetadata(metadata: Record<string, any>): Array<{ label: string; value: string }> {
  return Object.entries(metadata).map(([key, value]) => {
    const label = formatFieldName(key)
    let formattedValue: string
    
    if (key.toLowerCase().includes('amount')) {
      formattedValue = formatCurrency(value)
    } else if (key.toLowerCase().includes('date') || key.toLowerCase().includes('time')) {
      formattedValue = new Date(value).toLocaleString()
    } else if (typeof value === 'boolean') {
      formattedValue = value ? 'Yes' : 'No'
    } else if (value === null || value === undefined) {
      formattedValue = 'None'
    } else {
      formattedValue = String(value)
    }
    
    return { label, value: formattedValue }
  })
}

export function getActionIcon(action: string): string {
  if (action === 'TRANSACTION_CREATED') return 'plus'
  if (action === 'TRANSACTION_EDITED') return 'edit'
  if (action === 'TRANSACTION_DELETED') return 'trash'
  return 'info'
}
