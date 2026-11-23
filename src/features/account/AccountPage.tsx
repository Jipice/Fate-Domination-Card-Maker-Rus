"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../cloud/supabase";
import { copyLocalToCloud } from "../cloud/cloud";

const buttonClass = "import-export-button bg-blue-500 hover:bg-blue-400 justify-center";

const AccountPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [user, setUser] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const { data } = await supabase.auth.getSession();
    setUser(data.session?.user.email ?? null);
  };

  useEffect(() => {
    refresh();
    const { data } = supabase.auth.onAuthStateChange(() => refresh());
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage(
          data.session
            ? "Аккаунт создан, вы вошли."
            : "Аккаунт создан. Если включено подтверждение, откройте письмо и перейдите по ссылке, затем войдите.",
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setMessage("Вы вошли.");
      }
      setPassword("");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Не удалось войти");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setMessage("Вы вышли. Карты теперь берутся из этого браузера.");
  };

  const moveLocal = async () => {
    setBusy(true);
    try {
      const { folders, cards } = await copyLocalToCloud();
      setMessage(`Перенесено в аккаунт: карт ${cards}, папок ${folders}. Копия в браузере осталась на месте.`);
    } catch (err) {
      setMessage(err instanceof Error ? `Перенос не удался: ${err.message}` : "Перенос не удался");
    } finally {
      setBusy(false);
    }
  };

  if (user) {
    return (
      <div className="flex flex-col gap-4 max-w-md">
        <h1 className="text-xl font-semibold">Аккаунт</h1>
        <p>Вы вошли как <b>{user}</b>.</p>
        <div className="flex flex-col gap-2">
          <button className={buttonClass} onClick={moveLocal} disabled={busy}>
            Перенести библиотеку из браузера в аккаунт
          </button>
          <button className="import-export-button bg-gray-700 hover:bg-red-800" onClick={signOut}>
            Выйти
          </button>
        </div>
        {message && <p className="italic">{message}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-md">
      <h1 className="text-xl font-semibold">Аккаунт</h1>
      <div className="flex gap-2">
        <button
          className={mode === "login" ? buttonClass : "import-export-button bg-gray-700 hover:bg-gray-600"}
          onClick={() => setMode("login")}
        >
          Войти
        </button>
        <button
          className={mode === "register" ? buttonClass : "import-export-button bg-gray-700 hover:bg-gray-600"}
          onClick={() => setMode("register")}
        >
          Регистрация
        </button>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="field-header">Почта</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="field-header">Пароль</span>
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button type="submit" className={buttonClass} disabled={busy}>
          {mode === "login" ? "Войти" : "Создать аккаунт"}
        </button>
      </form>
      {message && <p className="italic">{message}</p>}
    </div>
  );
};

export default AccountPage;
