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
  half_day?: 'AM' | 'PM' | null
  note: string | null
  created_at?: string
}

export interface OvertimeEntry {
  id: number
  employee_id: string
  date: string
  hours: number
  type: 'earn' | 'use'
  note: string | null
  created_at?: string
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

export interface ScheduleConfirmed {
  year: number
  month: number
  confirmed_at: string | null
  confirmed_by: string | null
}

export interface ScheduleSwapLog {
  id: number
  year: number
  month: number
  day: number
  emp1_id: string
  emp2_id: string
  emp1_old_status: string | null
  emp2_old_status: string | null
  requested_by: string | null
  swapped_at: string
}

export interface OffQuota {
  dept: string
  max_persons: number
  updated_at: string
  updated_by: string | null
}

type EmployeeRow = Employee
type EmployeeInsert = Omit<Employee, 'created_at'>
type EmployeeUpdate = Partial<EmployeeInsert>

type LeaveEntryInsert = Omit<LeaveEntry, 'id' | 'created_at'>
type HrChangeInsert = Omit<HrChange, 'id' | 'created_at' | 'employees'>
type OvertimeInsert = Omit<OvertimeEntry, 'id' | 'created_at'>

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
      hr_changes: {
        Row: HrChange
        Insert: HrChangeInsert
        Update: Partial<HrChangeInsert>
        Relationships: []
      }
      overtime: {
        Row: OvertimeEntry
        Insert: OvertimeInsert
        Update: Partial<OvertimeInsert>
        Relationships: []
      }
      schedule_confirmed: {
        Row: ScheduleConfirmed
        Insert: ScheduleConfirmed
        Update: Partial<ScheduleConfirmed>
        Relationships: []
      }
      off_quotas: {
        Row: OffQuota
        Insert: OffQuota
        Update: Partial<OffQuota>
        Relationships: []
      }
      schedule_swap_logs: {
        Row: ScheduleSwapLog
        Insert: Omit<ScheduleSwapLog, 'id' | 'swapped_at'>
        Update: never
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
      swap_schedules: {
        Args: { p_emp1: string; p_emp2: string; p_year: number; p_month: number; p_day: number }
        Returns: void
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
