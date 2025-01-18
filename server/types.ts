import { UserRole } from "@db/schema";

export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  companyId?: number;
  isAdmin: boolean;
}
