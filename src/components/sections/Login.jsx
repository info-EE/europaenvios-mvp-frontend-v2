/* eslint-disable react/prop-types */
import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase";
import { Input } from "../common/Input";
import { PasswordInput } from "../common/PasswordInput";
import { Field } from "../common/Field";
import { Button } from "../common/Button";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setErr("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      if (
        error.code === "auth/user-not-found" ||
        error.code === "auth/wrong-password" ||
        error.code === "auth/invalid-credential"
      ) {
        setErr("Usuario o contraseña incorrectos.");
      } else {
        console.error("Firebase Login Error:", error);
        setErr("Error al iniciar sesión. Inténtalo de nuevo.");
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 w-full max-w-md">
        <img
          src="/logo.png"
          alt="Logo Europa Envíos"
          className="w-48 mx-auto mb-6"
        />
        <h1 className="text-2xl font-bold text-slate-800 mb-4 text-center">
          Acceso al sistema
        </h1>
        <form onSubmit={handleLogin}>
          <Field label="Email" required>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@empresa.com"
              autoComplete="email"
            />
          </Field>
          <div className="h-4" />
          <Field label="Contraseña" required>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </Field>
          {err && (
            <div className="text-red-600 text-sm my-2 text-center">{err}</div>
          )}
          <Button type="submit" variant="primary" disabled={loading} className="w-full mt-4">
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}