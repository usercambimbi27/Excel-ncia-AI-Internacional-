// Estado local de acesso (só no navegador; ler apenas após hidratação).
const KEY = "exc.k";
const UNLOCK = "exc.u";
const EVT = "exc-access-change";

const ls = () => (typeof window === "undefined" ? null : window.localStorage);

export const getUserKey = () => ls()?.getItem(KEY) ?? "";
export const setUserKey = (k: string) => {
  if (k) ls()?.setItem(KEY, k);
  else ls()?.removeItem(KEY);
  window.dispatchEvent(new Event(EVT));
};
export const isUnlocked = () => ls()?.getItem(UNLOCK) === "1";
export const setUnlocked = (v: boolean) => {
  if (v) ls()?.setItem(UNLOCK, "1");
  else ls()?.removeItem(UNLOCK);
  window.dispatchEvent(new Event(EVT));
};
export const onAccessChange = (cb: () => void) => {
  window.addEventListener(EVT, cb);
  return () => window.removeEventListener(EVT, cb);
};
