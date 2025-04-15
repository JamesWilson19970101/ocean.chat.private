// Permission initialization

// Define an interface for the permission rule structure (when conf is 'p')
interface PermissionRule {
  conf: 'p'; // Configuration type: permission
  sub: string; // Subject (e.g., user role)
  obj_type: string; // Object type (e.g., 'menu', 'api')
  obj: string; // Object identifier (e.g., route, resource name)
  act: string; // Action allowed (e.g., 'view', 'edit')
}

// Define an interface for the grouping rule structure (when conf is 'g')
interface GroupingRule {
  conf: 'g'; // Configuration type: grouping
  sub1: string; // Subject 1 (e.g., user)
  sub2: string; // Subject 2 (e.g., group/role the user belongs to)
}

// Define a union type that can represent either a PermissionRule or a GroupingRule
type PermissionEntry = PermissionRule | GroupingRule;
export const permissions: PermissionEntry[] = [
  {
    conf: 'p',
    sub: 'admin',
    obj_type: 'menu',
    obj: '/admin',
    act: 'view',
  },
  {
    conf: 'g',
    sub1: 'james',
    sub2: 'admin',
  },
];
