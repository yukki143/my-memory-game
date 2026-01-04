// frontend/src/utils/auth.ts

// ★修正: 環境変数から読み込み、末尾のスラッシュを除去して正規化する
const getApiBase = () => {
  const url = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
  return url.replace(/\/$/, ""); 
};

const API_URL = getApiBase();
const TOKEN_KEY = "token";

export const getToken = () => localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);

export const setToken = (token: string, remember: boolean) => {
  if (remember) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
  }
};

export const removeToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
};

// ログアウト処理
export const logout = () => {
  removeToken();
  // 念のため古いキー名称も削除
  localStorage.removeItem("access_token");
  sessionStorage.removeItem("access_token");
};

/**
 * 認証付きのFetchラッパー
 * @param endpoint スラッシュから始まるパス (例: "/api/users/me")
 */
export const authFetch = async (endpoint: string, options: RequestInit = {}) => {
  const token = getToken();
  
  // ★修正: エンドポイントがスラッシュで始まっていない場合の補正
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    // トークン切れ、または不正な場合はログアウトしてログイン画面へ
    logout();
    window.location.href = "/login";
  }

  return res;
};

/**
 * ログインリクエスト (OAuth2PasswordRequestForm形式)
 */
export const loginRequest = async (username: string, password: string) => {
  const formData = new URLSearchParams();
  formData.append("username", username);
  formData.append("password", password);

  // ★修正: API_URLとの結合を安全に行う
  return fetch(`${API_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData,
  });
};