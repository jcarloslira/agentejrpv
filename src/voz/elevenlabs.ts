/**
 * Voz da Paloma (ElevenLabs): texto → áudio e áudio → texto.
 */
import { config } from "../config.js";
import { paraFala } from "./fonetica.js";

const BASE = "https://api.elevenlabs.io/v1";

export const vozLigada = () => !!config.elevenKey && !!config.elevenVoz;

/**
 * Ajuste fino da voz: estabilidade média deixa a fala natural sem "inventar" entonação;
 * estilo baixo evita teatralidade (nada de sotaque caricato), velocidade levemente
 * abaixo do padrão para quem escuta no carro ou na rua.
 */
const AJUSTES = { stability: 0.5, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true, speed: 0.97 };

export async function falar(texto: string): Promise<string> {
  const fala = paraFala(texto).slice(0, 2500);
  const r = await fetch(`${BASE}/text-to-speech/${config.elevenVoz}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": config.elevenKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text: fala, model_id: config.elevenModelo, language_code: "pt", voice_settings: AJUSTES }),
  });
  if (!r.ok) throw new Error(`ElevenLabs (voz) respondeu ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return Buffer.from(await r.arrayBuffer()).toString("base64");
}

export async function transcrever(base64: string, mime: string): Promise<string> {
  const fd = new FormData();
  fd.append("model_id", "scribe_v1");
  fd.append("language_code", "por");
  fd.append("file", new Blob([Buffer.from(base64, "base64")], { type: mime }), "audio." + (mime.includes("mpeg") ? "mp3" : "ogg"));
  const r = await fetch(`${BASE}/speech-to-text`, { method: "POST", headers: { "xi-api-key": config.elevenKey }, body: fd });
  if (!r.ok) throw new Error(`ElevenLabs (transcrição) respondeu ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j: any = await r.json();
  return String(j.text || "").trim();
}

/** Vozes disponíveis na conta (para escolher a da Paloma). */
export async function listarVozes(): Promise<Array<{ id: string; nome: string; idioma: string | null; descricao: string | null }>> {
  const r = await fetch(`${BASE}/voices`, { headers: { "xi-api-key": config.elevenKey } });
  if (!r.ok) throw new Error(`ElevenLabs respondeu ${r.status}`);
  const j: any = await r.json();
  return (j.voices || []).map((v: any) => ({ id: v.voice_id, nome: v.name, idioma: v.labels?.language || v.labels?.accent || null, descricao: v.description || v.labels?.description || null }));
}
