import { Permission, RolePermissions, UserRoleType, UserPermission } from "@shared/schema";

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermissionError";
  }
}

export function hasPermission(userRole: UserRoleType, requiredPermission: UserPermission): boolean {
  const permissions = RolePermissions[userRole];
  return permissions.includes(requiredPermission as any);
}

export function checkPermission(userRole: UserRoleType, requiredPermission: UserPermission): void {
  if (!hasPermission(userRole, requiredPermission)) {
    throw new PermissionError(`User with role ${userRole} does not have permission: ${requiredPermission}`);
  }
}

export function getUserPermissions(userRole: UserRoleType): UserPermission[] {
  return RolePermissions[userRole] as UserPermission[];
}

// Helper to check if a user can override another user's role
export function canManageRole(managerRole: UserRoleType, targetRole: UserRoleType): boolean {
  const roleHierarchy = [
    'agent',
    'sr_agent',
    'queue_manager',
    'admin'
  ];
  
  const managerLevel = roleHierarchy.indexOf(managerRole);
  const targetLevel = roleHierarchy.indexOf(targetRole);
  
  // Admin can manage all roles, others can only manage roles below them
  return managerRole === 'admin' || (managerLevel > targetLevel);
}
