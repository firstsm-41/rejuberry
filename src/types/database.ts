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
  reason: string | null
  status: 'pending' | 'approved' | 'rejected'
  rejected_reason: string | null
  approved_by: string | null
  note: string | null
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

type EmployeeRow = Employee
type EmployeeInsert = Omit<Employee, 'created_at'>
type EmployeeUpdate = Partial<EmployeeInsert>

type LeaveEntryInsert = Omit<LeaveEntry, 'id' | 'created_at'>
type LeaveRequestInsert = Omit<LeaveRequest, 'id' | 'created_at' | 'updated_at' | 'employees'>
type HrChangeInsert = Omit<HrChange, 'id' | 'created_at' | 'employees'>

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at'>
        Update: Partial<Omit<Profile, 'created_at'>>
        Relationships: []
      }
      employees: {
        Row: EmployeeRow
        Insert: EmployeeInsert
        Update: EmployeeUpdate
        Relationships: []
      }
      schedules: {
        Row: Schedule
        Insert: Omit<Schedule, 'id'>
        Update: Partial<Omit<Schedule, 'id'>>
        Relationships: []
      }
      leave_data: {
        Row: LeaveData
        Insert: Omit<LeaveData, 'id'>
        Update: Partial<Omit<LeaveData, 'id'>>
        Relationships: []
      }
      leave_entries: {
        Row: LeaveEntry
        Insert: LeaveEntryInsert
        Update: Partial<LeaveEntryInsert>
        Relationships: []
      }
      leave_requests: {
        Row: LeaveRequest
        Insert: LeaveRequestInsert
        Update: Partial<LeaveRequestInsert>
        Relationships: []
      }
      hr_changes: {
        Row: HrChange
        Insert: HrChangeInsert
        Update: Partial<HrChangeInsert>
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      verify_employee: {
        Args: { p_name: string; p_birth_date: string }
        Returns: Array<{ employee_id: string; emp_level: number }>
      }
      my_level: {
        Args: { [_ in never]: never }
        Returns: number
      }
      my_employee_id: {
        Args: { [_ in never]: never }
        Returns: string
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
