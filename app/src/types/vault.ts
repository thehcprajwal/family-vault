export interface PersonRecord {
  personId: string;
  displayName: string;
  relationship: string;
}

export interface CategoryRecord {
  categoryId: string;
  name: string;
  subcategories: string[];
  enabled: boolean;
  colour: string;
  icon: string;
}
