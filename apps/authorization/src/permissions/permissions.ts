// Permission initialization

// Define an interface for the role definition and policy definition
interface CasbinRule {
  ptype: 'p' | 'g'; // type of rule: 'p' or 'g'
  v0?: string;
  v1?: string;
  v2?: string;
  v3?: string;
}

// Define a union type that can represent either a PermissionRule or a GroupingRule
type PermissionEntry = CasbinRule;
export const permissions: PermissionEntry[] = [
  {
    ptype: 'p',
    v0: 'admin',
    v1: 'menu',
    v2: '/admin',
    v3: 'view',
  },
  {
    ptype: 'g',
    v0: 'james',
    v1: 'admin',
  },
];
