export default {
  define: {
    __VERSION__: JSON.stringify(process.env.BONK_VERSION ?? "dev"),
    __COMMIT__: JSON.stringify(process.env.BONK_COMMIT ?? "unknown"),
  },
};
