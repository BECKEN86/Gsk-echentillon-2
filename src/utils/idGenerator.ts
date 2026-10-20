let counter = 0;

/**
 * Generates a guaranteed unique ID with a prefix, timestamp, incremental counter,
 * and random component to prevent any key collisions in React lists or state arrays.
 */
export const generateUniqueId = (prefix: string = 'id'): string => {
  counter += 1;
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${timestamp}_${counter}_${randomSuffix}`;
};
