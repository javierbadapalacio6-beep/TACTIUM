/** Error de «Recordar ahora»: sin plan, en bloqueo de 12 h u otro. */
export class RemindError extends Error {
  constructor(
    message: string,
    public kind: 'premium' | 'cooldown' | 'other',
    public nextAllowedAt?: Date,
  ) {
    super(message);
  }
}
