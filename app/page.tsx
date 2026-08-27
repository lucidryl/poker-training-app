"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { createClient } from "@/lib/supabase/client";

export default function HomePage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  // Auth state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading2, setAuthLoading2] = useState(false);

  const fakeEmail = username ? `${username.toLowerCase()}@poker.local` : "";

  // Room state
  const [roomName, setRoomName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [roomError, setRoomError] = useState("");
  const [roomLoading, setRoomLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading2(true);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email: fakeEmail,
        password,
        options: {
          data: { username },
        },
      });

      if (error) {
        setAuthError(error.message);
        setAuthLoading2(false);
        return;
      }

      // Crear perfil
      const { data: { user: newUser } } = await supabase.auth.getUser();
      if (newUser) {
        await supabase.from("profiles").insert({
          id: newUser.id,
          username,
        } as never);
      }

      setAuthLoading2(false);
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: fakeEmail,
        password,
      });

      if (error) {
        setAuthError(error.message);
      }
      setAuthLoading2(false);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setRoomError("");
    setRoomLoading(true);

    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: roomName }),
      });

      const data = await res.json();
      if (!res.ok) {
        setRoomError(data.error ?? "Error al crear sala.");
        setRoomLoading(false);
        return;
      }

      router.push(`/room/${data.roomCode}`);
    } catch {
      setRoomError("Error de conexión.");
      setRoomLoading(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setRoomError("");
    setRoomLoading(true);

    try {
      const res = await fetch(`/api/rooms/${roomCode}/join`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) {
        setRoomError(data.error ?? "Error al unirse.");
        setRoomLoading(false);
        return;
      }

      router.push(`/room/${data.roomCode}`);
    } catch {
      setRoomError("Error de conexión.");
      setRoomLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </main>
    );
  }

  // Formulario de autenticación
  if (!user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold">Poker Training</h1>
            <p className="mt-2 text-muted-foreground">
              Texas Hold&apos;em No-Limit en tiempo real
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4 rounded-lg border border-border bg-muted/50 p-6">
            <h2 className="text-lg font-semibold">
              {isSignUp ? "Crear cuenta" : "Iniciar sesión"}
            </h2>

            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                Nombre de usuario
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                placeholder="Tu alias en la mesa"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                placeholder="••••••"
              />
            </div>

            {authError && (
              <p className="text-sm text-destructive">{authError}</p>
            )}

            <button
              type="submit"
              disabled={authLoading2}
              className="w-full rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {authLoading2
                ? "Cargando..."
                : isSignUp
                  ? "Crear cuenta"
                  : "Iniciar sesión"}
            </button>

            <p className="text-center text-sm text-muted-foreground">
              {isSignUp ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setAuthError("");
                }}
                className="text-primary underline"
              >
                {isSignUp ? "Iniciar sesión" : "Crear cuenta"}
              </button>
            </p>
          </form>
        </div>
      </main>
    );
  }

  // Panel de salas (usuario autenticado)
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Poker Training</h1>
          <p className="mt-2 text-muted-foreground">
            Hola, <span className="font-medium text-foreground">{user.user_metadata?.username ?? user.email}</span>
          </p>
        </div>

        {/* Crear sala */}
        <form onSubmit={handleCreateRoom} className="space-y-3 rounded-lg border border-border bg-muted/50 p-6">
          <h2 className="text-lg font-semibold">Crear sala privada</h2>
          <input
            type="text"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            required
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
            placeholder="Nombre de la sala"
          />
          <button
            type="submit"
            disabled={roomLoading}
            className="w-full rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {roomLoading ? "Creando..." : "Crear sala"}
          </button>
        </form>

        {/* Unirse a sala */}
        <form onSubmit={handleJoinRoom} className="space-y-3 rounded-lg border border-border bg-muted/50 p-6">
          <h2 className="text-lg font-semibold">Unirse a sala</h2>
          <input
            type="text"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            required
            maxLength={8}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm uppercase tracking-widest"
            placeholder="Código de sala"
          />
          <button
            type="submit"
            disabled={roomLoading}
            className="w-full rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {roomLoading ? "Uniendo..." : "Unirse"}
          </button>
        </form>

        {roomError && (
          <p className="text-center text-sm text-destructive">{roomError}</p>
        )}

        <button
          onClick={handleSignOut}
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          Cerrar sesión
        </button>
      </div>
    </main>
  );
}
