export class QuotaExceededError extends Error {
  public readonly service: string;

  constructor(service: string, message?: string) {
    super(message ?? `${service} quota exceeded`);
    this.name = 'QuotaExceededError';
    this.service = service;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class FeatureDisabledError extends Error {
  public readonly feature: string;

  constructor(feature: string, message?: string) {
    super(message ?? `${feature} feature disabled`);
    this.name = 'FeatureDisabledError';
    this.feature = feature;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
