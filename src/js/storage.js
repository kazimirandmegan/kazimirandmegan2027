/* Safe storage wrappers — private browsing must not crash the gate */

export const store = {
  /* per-tab (clears when the tab closes) */
  get(k) {
    try {
      return sessionStorage.getItem(k);
    } catch (e) {
      return null;
    }
  },
  set(k, v) {
    try {
      sessionStorage.setItem(k, v);
    } catch (e) {}
  },
  del(k) {
    try {
      sessionStorage.removeItem(k);
    } catch (e) {}
  },
};

export const lstore = {
  /* persistent on this device */
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
      return true;
    } catch (e) {
      return false;
    }
  },
  del(k) {
    try {
      localStorage.removeItem(k);
    } catch (e) {}
  },
};
