export interface DevicePresence {
  deviceId: string;
  deviceType: string;
  gatewayId: string;
  status: 'online' | 'away' | 'busy';
  connectTime: string;
}

export interface PresenceDeviceStatus {
  userId: string;
  isOnline: boolean;
  devices: DevicePresence[]; // Empty if completely offline
}
