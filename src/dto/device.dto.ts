export interface CreateDeviceDto {
  branch_id: string;
  counter_id?: string;
  device_type: "TICKET_KIOSK" | "TICKET_PRINTER" | "QUEUE_DISPLAY" | "COUNTER_DISPLAY" | "OPERATOR_KEYBOARD" | "QR_SCANNER" | "MEDIA_DISPLAY";
  name: string;
  serial_number?: string;
  ip_address?: string;
  mac_address?: string;
  firmware_version?: string;
  settings?: Record<string, unknown>;
}

export interface UpdateDeviceDto {
  name?: string;
  counter_id?: string;
  ip_address?: string;
  mac_address?: string;
  firmware_version?: string;
  settings?: Record<string, unknown>;
  status?: "ONLINE" | "OFFLINE" | "MAINTENANCE";
}

export interface DeviceHeartbeatDto {
  status: "ONLINE" | "OFFLINE" | "MAINTENANCE";
  cpu_usage?: number;
  memory_usage?: number;
  disk_usage?: number;
  temperature?: number;
  uptime_seconds?: number;
  network_latency_ms?: number;
}
