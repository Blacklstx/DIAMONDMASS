export type GoalType = 'cutting' | 'bulking';
export type LanguageType = 'th' | 'en';
export type UserRole = 'user' | 'admin';

export interface GenderOption {
  value: string;
  labelTh: string;
  labelEn: string;
}

export const GENDER_OPTIONS: GenderOption[] = [
  { value: 'male', labelTh: 'ชาย (Male)', labelEn: 'Male' },
  { value: 'female', labelTh: 'หญิง (Female)', labelEn: 'Female' },
  { value: 'gay', labelTh: 'เกย์ (Gay)', labelEn: 'Gay' },
  { value: 'lesbian', labelTh: 'เลสเบี้ยน (Lesbian)', labelEn: 'Lesbian' },
  { value: 'kathoey', labelTh: 'สาวประเภทสอง / กะเทย (Trans Woman)', labelEn: 'Trans Woman' },
  { value: 'tom', labelTh: 'ทอม (Tom)', labelEn: 'Tom' },
  { value: 'dee', labelTh: 'ดี้ (Dee)', labelEn: 'Dee' },
  { value: 'trans_male', labelTh: 'ชายข้ามเพศ (Transgender Male)', labelEn: 'Transgender Male' },
  { value: 'trans_female', labelTh: 'หญิงข้ามเพศ (Transgender Female)', labelEn: 'Transgender Female' },
  { value: 'bisexual', labelTh: 'ไบเซ็กชวล (Bisexual)', labelEn: 'Bisexual' },
  { value: 'pansexual', labelTh: 'แพนเซ็กชวล (Pansexual)', labelEn: 'Pansexual' },
  { value: 'non_binary', labelTh: 'นอนไบนารี (Non-binary)', labelEn: 'Non-binary' },
  { value: 'queer_lgbtq', labelTh: 'เควียร์ / LGBTQ+', labelEn: 'Queer / LGBTQ+' },
  { value: 'asexual', labelTh: 'เอเซ็กชวล (Asexual)', labelEn: 'Asexual' },
  { value: 'other', labelTh: 'อื่น ๆ (ระบุเอง)', labelEn: 'Other (Custom)' },
  { value: 'prefer_not_to_say', labelTh: 'ไม่ต้องการระบุ (Prefer not to say)', labelEn: 'Prefer not to say' },
];

export interface UserProfile {
  id: string;
  email?: string | null;
  name?: string | null;
  gender?: string | null;
  role?: UserRole;
  created_at?: string;
}

export interface TraineeProfile {
  user_id: string;
  goal?: GoalType;
  start_date?: string | null;
  start_weight?: number | null;
  target_weight?: number | null;
  start_waist?: number | null;
  age?: number | null;
  height?: number | null;
  training_days?: number | null;
  steps_target?: number | null;
  calorie_target?: number | null;
  protein_target?: number | null;
  cardio_target?: number | null;
  allow_future_checkins?: boolean;
  language?: LanguageType;
  coach_token?: string;
  coach_share_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

// Joined representation for backwards compatibility
export interface Profile extends UserProfile {
  goal?: GoalType;
  age?: number | null;
  height?: number | null;
  start_date?: string | null;
  start_weight?: number | null;
  target_weight?: number | null;
  start_waist?: number | null;
  training_days?: number | null;
  steps_target?: number | null;
  calorie_target?: number | null;
  protein_target?: number | null;
  cardio_target?: number | null;
  allow_future_checkins?: boolean;
  language?: LanguageType;
  coach_token?: string;
  coach_share_active?: boolean;
}

export interface TrainingLift {
  name: string;
  weight: number | null;
  reps: number | null;
}

export interface DayWeight {
  weight: number | null;
}

export interface CheckinPhotos {
  front?: boolean;
  left?: boolean;
  right?: boolean;
  back?: boolean;
}

export interface CheckinData {
  days?: Record<string, DayWeight>; // day1 .. day7
  waist?: number | null;
  hips?: number | null;
  chest?: number | null;
  arm?: number | null;
  thigh?: number | null;
  calories?: number | null;
  protein?: number | null;
  nutrition?: number | null; // Adherence days followed plan (0-7)
  steps?: number | null;
  cardio?: number | null;
  energy?: number | null;
  sleep?: number | null;
  stress?: number | null;
  notes?: string;
  training?: Record<string, TrainingLift[]>; // day1 .. day7
  photos?: CheckinPhotos;
}

export interface Checkin {
  id?: string;
  user_id?: string;
  week: number;
  data: CheckinData;
  updated_at?: string;
}

export interface CheckinPhotoRecord {
  id?: string;
  user_id?: string;
  week: number;
  front_path?: string | null;
  left_path?: string | null;
  right_path?: string | null;
  back_path?: string | null;
  updated_at?: string;
}

export interface CoachReport {
  profile: Omit<Profile, 'coach_token'>;
  checkins: (CheckinData & { week: number })[];
}
