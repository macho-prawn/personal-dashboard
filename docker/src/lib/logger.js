const format = (level, msg, meta) => {
  const time = new Date().toISOString();
  if (meta === undefined) return `[${time}] [${level}] ${msg}`;
  return `[${time}] [${level}] ${msg} ${JSON.stringify(meta)}`;
};

export const logger = {
  info(msg, meta) {
    console.log(format('INFO', msg, meta));
  },
  warn(msg, meta) {
    console.warn(format('WARN', msg, meta));
  },
  error(msg, meta) {
    console.error(format('ERROR', msg, meta));
  }
};
