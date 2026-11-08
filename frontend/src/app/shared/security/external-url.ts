const allowedExternalHosts = ['aktionen.gaerngschee.ch'] as const;

export const isAllowedExternalUrl = (value: string): boolean => {
  try {
    const url = new URL(value);

    return (
      url.protocol === 'https:' &&
      url.username === '' &&
      url.password === '' &&
      url.port === '' &&
      allowedExternalHosts.includes(url.hostname as (typeof allowedExternalHosts)[number])
    );
  } catch {
    return false;
  }
};
