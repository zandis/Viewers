/**
 * Global user information, to be replaced with a  specific version which
 * applies the methods.
 */
export let user = {
  userLoggedIn: (): boolean => false,
  getUserId: () => null,
  getName: () => null,
  getAccessToken: () => null,
  login: () => new Promise((resolve, reject) => reject()),
  logout: () => new Promise((resolve, reject) => reject()),
  getData: key => null,
  setData: (key, value) => null,
};

/**
 * Interface to clearly present the expected fields to linters when passing the user account
 * struct.
 */
export interface UserAccountInterface {
  userLoggedIn?: () => boolean;
  getUserId?: () => string | null;
  getName?: () => string | null;
  getAccessToken?: () => string | null;
  login?: () => Promise<void>;
  logout?: () => Promise<void>;
  getData?: (key: string) => unknown;
  setData?: (key: string, value: unknown) => void;
}

export default user;
