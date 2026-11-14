import { GoogleGenerativeAI } from '@google/generative-ai';

const SYSTEM_PROMPT = `Ты ассистент сайта «Карта русского баптизма». Отвечай кратко, по-русски, опираясь на проверенные источники: журнал «Баптист», «Братский вестник», baptistru.info, baptist.org.ru, rusbaptist.stunda.org, pravenc.ru, ВСЕХБ «История ЕХБ в СССР» 1989. Не используй Савинского как финальную опору. Важно: Каргель — выдающийся богослов и духовный учитель, не основоположник; по pravenc.ru Каргель крещён Ворониным в 1869; Павлов крещён Ворониным в апреле 1871; в 1875 Павлова в Гамбурге обучал Пётр Вильрат, так как семинария была распущена; ВСЕХ создан в сентябре 1909; СЦ ЕХБ создан в сентябре 1965; Прицкау — 1914, Фризен — 1911.`;

export async function askGemini(question: string): Promise<string | null> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return null;
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(`${SYSTEM_PROMPT}\n\nВопрос пользователя: ${question}`);
    return result.response.text();
  } catch {
    return null;
  }
}
