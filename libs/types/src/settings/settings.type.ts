export interface SettingsModuleOptions {
  /**
   * Whether to run default settings seeding and cache warming on startup.
   * Should be TRUE only for the "Owner" service (e.g., Auth or Admin).
   * Default: false
   */
  runSeeds?: boolean;
}
