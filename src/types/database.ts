export type UserLevel = 0 | 1 | 2

export interface Profile {
  id: string
  employee_id: string | null
  name: string
  level: UserLevel
  created_at: string
}

export interface Employee {
  id: string
  name: string
  ssn: string | null
  birth_date: string | null
  phone: string | null
  email: string | null
  dept: string
  position: string
  note: string | null
  salary: string | null
  prev_company: string | null
  start_date: string
  end_date: string | null
  status: 'active' | 'retired'
  created_at?: string
  updated_at?: string
}

export interface Schedule {
  id: number
  employee_id: string
  year: number
  month: number
  day: number
  status: 'D' | 'S' | 'H' | 'Y' | 'OFF'
}

export interface LeaveData {
  id: number
  employee_id: string
  year: number
  total_days: number
}

export interface LeaveEntry {
  id: number
  employee_id: string
  year: number
  start_date: string
  end_date: string
  days: number
  type: 'Y' | 'H'
  note: string | null
  created_at?: string
}

export interface LeaveRequest {
  id: number
  employee_id: string
  requester_id: string | null
  start_date: string
  end_date: string
  days: number
  type: 'Y' | 'H'
  note: string | null
  status: 'pending' | 'approved' | 'rejected'
  rejected_reason: string | null
  approved_by: string | null
  created_at: string
  updated_at: string | null
  employees?: { name: string; dept: string; position: string } | null
}

export interface HrChange {
  id: number
  employee_id: string
  type: 'join' | 'leave'
  date: string
  note: string | null
  created_at?: string
  employees?: { name: string; dept: string; position: string } | null
}

// Supabase Database type shape
export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Omit<Profile, 'created_at'>; Update: Partial<Profile> }
      employees: { Row: Employee; Insert: Omit<Employee, 'created_at' | 'updated_at'>; Update: Partial<Employee> }
      schedules: { Row: Schedule; Insert: Omit<Schedule, 'id'>; Update: Partial<Schedule> }
      leave_data: { Row: LeaveData; Insert: Omit<LeaveData, 'id'>; Update: Partial<LeaveData> }
      leave_entries: { Row: LeaveEntry; Insert: Omit<LeaveEntry, 'id' | 'created_at'>; Update: Partial<LeaveEntry> }
      leave_requests: { Row: LeaveRequest; Insert: Omit<LeaveRequest, 'id' | 'created_at' | 'updated_at'>; Update: Partial<LeaveRequest> }
      hr_changes: { Row: HrChange; Insert: Omit<HrChange, 'id' | 'created_at'>; Update: Partial<HrChange> }
    }
    Functions: {
      get_user_level: { Returns: number }
    }
  }
}
