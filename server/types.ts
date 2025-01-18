import { type UserRole } from "@db/schema";

export interface User {
  id: number;
  username: string;
  email: string;
  role: typeof UserRole[keyof typeof UserRole];
  companyId?: number;
  isAdmin: boolean;
}