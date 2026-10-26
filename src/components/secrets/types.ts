// Lo que el servidor manda al navegador: nunca incluye valores.
export type SecretRow = { id: string; environment: string; key: string; notes: string | null; updated: string }
export type BackupRow = { id: string; environment: string; keyCount: number; source: string; created: string }
