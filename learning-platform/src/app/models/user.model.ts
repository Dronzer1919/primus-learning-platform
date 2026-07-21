export interface User {
  id: string;
  email: string;
  username: string;
  displayName?: string;
  avatar?: string;
  role: 'admin' | 'user';
  createdAt: Date;
  lastLogin?: Date;
  loginCount?: number;
  isOnline?: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  email: string;
  username: string;
  password: string;
  displayName?: string;
  phone?: string;
  country?: string;
  city?: string;
  address?: string;
}

export interface UserStats {
  totalUsers: number;
  activeNow: number;
  totalSessions: number;
  googleUsers: number;
  todayLogins: number;
  recentLogins: RecentLogin[];
}

export interface RecentLogin {
  user: { username: string; email: string; displayName?: string; avatar?: string; role: string } | null;
  loginMethod: 'local' | 'google';
  loginAt: Date;
  logoutAt?: Date;
  durationMinutes?: number;
  deviceType: string;
}
