export const UI_LANGS = ["en", "hi", "zh", "ja", "ru", "es", "fr", "pt", "ar", "ko"] as const;
export type UiLang = typeof UI_LANGS[number];

const en = {
  obTitle: "Let's tune LinguaScript to you.",
  obSub: "Tell us your languages and current level — this powers translations and recommendations.",
  iSpeak: "I speak (native)",
  iLearn: "I want to learn",
  howLearn: "How do you want to learn?",
  myLevel: "My current level",
  totalBeginner: "I'm a total beginner",
  schoolOptional: "School (optional)",
  next: "Next",
  back: "Back",
  startLearning: "Start learning",
  saving: "Saving…",
  saveFailed: "Couldn't save just now — we'll keep your choices, try again in a moment.",
  welcomeBack: "Welcome back",
  joinLs: "Join LinguaScript",
  signInSub: "Sign in to continue learning",
  signUpSub: "Create your account to start learning",
  google: "Continue with Google",
  signingIn: "Signing in…",
  or: "or",
  displayName: "Display name",
  email: "Email",
  password: "Password",
  signIn: "Sign In",
  createAccount: "Create Account",
  loading: "Loading...",
  noAccount: "Don't have an account?",
  haveAccount: "Already have an account?",
  signUp: "Sign up",
  signInLink: "Sign in",
  appLanguage: "App language",
};
export type StringKey = keyof typeof en;
type Dict = Partial<Record<StringKey, string>>;

const hi: Dict = {
  obTitle: "आइए LinguaScript को आपके अनुसार तैयार करें।",
  obSub: "अपनी भाषाएँ और वर्तमान स्तर बताइए — इससे अनुवाद और सुझाव बेहतर होते हैं।",
  iSpeak: "मैं बोलता/बोलती हूँ (मातृभाषा)", iLearn: "मैं सीखना चाहता/चाहती हूँ",
  howLearn: "आप कैसे सीखना चाहते हैं?", myLevel: "मेरा वर्तमान स्तर",
  totalBeginner: "मैं बिल्कुल शुरुआती हूँ", schoolOptional: "स्कूल (वैकल्पिक)",
  next: "आगे", back: "पीछे", startLearning: "सीखना शुरू करें", saving: "सहेज रहे हैं…",
  saveFailed: "अभी सहेज नहीं पाए — आपकी पसंद सुरक्षित है, थोड़ी देर में फिर कोशिश करें।",
  welcomeBack: "फिर से स्वागत है", joinLs: "LinguaScript से जुड़ें",
  signInSub: "सीखना जारी रखने के लिए साइन इन करें", signUpSub: "सीखना शुरू करने के लिए खाता बनाएँ",
  google: "Google से जारी रखें", signingIn: "साइन इन हो रहा है…", or: "या",
  displayName: "नाम", email: "ईमेल", password: "पासवर्ड", signIn: "साइन इन",
  createAccount: "खाता बनाएँ", loading: "लोड हो रहा है...", noAccount: "खाता नहीं है?",
  haveAccount: "पहले से खाता है?", signUp: "साइन अप", signInLink: "साइन इन", appLanguage: "ऐप की भाषा",
};
const zh: Dict = {
  obTitle: "让 LinguaScript 为你量身定制。", obSub: "告诉我们你的语言和当前水平——这将用于翻译和推荐。",
  iSpeak: "我的母语", iLearn: "我想学习", howLearn: "你想怎样学习？", myLevel: "我目前的水平",
  totalBeginner: "我是零基础", schoolOptional: "学校（可选）", next: "下一步", back: "返回",
  startLearning: "开始学习", saving: "正在保存…", saveFailed: "暂时无法保存——你的选择已保留，请稍后再试。",
  welcomeBack: "欢迎回来", joinLs: "加入 LinguaScript", signInSub: "登录以继续学习", signUpSub: "创建账号开始学习",
  google: "使用 Google 继续", signingIn: "正在登录…", or: "或", displayName: "昵称", email: "邮箱",
  password: "密码", signIn: "登录", createAccount: "创建账号", loading: "加载中...", noAccount: "还没有账号？",
  haveAccount: "已有账号？", signUp: "注册", signInLink: "登录", appLanguage: "界面语言",
};
const ja: Dict = {
  obTitle: "LinguaScript をあなた向けに設定しましょう。", obSub: "言語と現在のレベルを教えてください。翻訳とおすすめに使われます。",
  iSpeak: "母国語", iLearn: "学びたい言語", howLearn: "どのように学びたいですか？", myLevel: "現在のレベル",
  totalBeginner: "まったくの初心者です", schoolOptional: "学校（任意）", next: "次へ", back: "戻る",
  startLearning: "学習を始める", saving: "保存中…", saveFailed: "今は保存できませんでした。選択内容は保持されています。少し後でもう一度お試しください。",
  welcomeBack: "おかえりなさい", joinLs: "LinguaScript に登録", signInSub: "ログインして学習を続けましょう", signUpSub: "アカウントを作成して学習を始めましょう",
  google: "Google で続ける", signingIn: "ログイン中…", or: "または", displayName: "表示名", email: "メールアドレス",
  password: "パスワード", signIn: "ログイン", createAccount: "アカウント作成", loading: "読み込み中...",
  noAccount: "アカウントをお持ちでないですか？", haveAccount: "すでにアカウントをお持ちですか？", signUp: "新規登録", signInLink: "ログイン", appLanguage: "表示言語",
};
const ru: Dict = {
  obTitle: "Настроим LinguaScript под вас.", obSub: "Укажите ваши языки и текущий уровень — это нужно для переводов и рекомендаций.",
  iSpeak: "Мой родной язык", iLearn: "Я хочу выучить", howLearn: "Как вы хотите учиться?", myLevel: "Мой текущий уровень",
  totalBeginner: "Я полный новичок", schoolOptional: "Школа (необязательно)", next: "Далее", back: "Назад",
  startLearning: "Начать учиться", saving: "Сохраняем…", saveFailed: "Не удалось сохранить — ваш выбор сохранён, попробуйте чуть позже.",
  welcomeBack: "С возвращением", joinLs: "Присоединяйтесь к LinguaScript", signInSub: "Войдите, чтобы продолжить обучение", signUpSub: "Создайте аккаунт, чтобы начать учиться",
  google: "Продолжить с Google", signingIn: "Входим…", or: "или", displayName: "Имя", email: "Эл. почта",
  password: "Пароль", signIn: "Войти", createAccount: "Создать аккаунт", loading: "Загрузка...",
  noAccount: "Нет аккаунта?", haveAccount: "Уже есть аккаунт?", signUp: "Регистрация", signInLink: "Войти", appLanguage: "Язык приложения",
};
const es: Dict = {
  obTitle: "Ajustemos LinguaScript para ti.", obSub: "Cuéntanos tus idiomas y tu nivel actual: así mejoramos traducciones y recomendaciones.",
  iSpeak: "Hablo (nativo)", iLearn: "Quiero aprender", howLearn: "¿Cómo quieres aprender?", myLevel: "Mi nivel actual",
  totalBeginner: "Soy principiante total", schoolOptional: "Centro educativo (opcional)", next: "Siguiente", back: "Atrás",
  startLearning: "Empezar a aprender", saving: "Guardando…", saveFailed: "No se pudo guardar ahora; tus elecciones se mantienen. Inténtalo en un momento.",
  welcomeBack: "Bienvenido de nuevo", joinLs: "Únete a LinguaScript", signInSub: "Inicia sesión para seguir aprendiendo", signUpSub: "Crea tu cuenta para empezar",
  google: "Continuar con Google", signingIn: "Iniciando sesión…", or: "o", displayName: "Nombre", email: "Correo",
  password: "Contraseña", signIn: "Iniciar sesión", createAccount: "Crear cuenta", loading: "Cargando...",
  noAccount: "¿No tienes cuenta?", haveAccount: "¿Ya tienes cuenta?", signUp: "Regístrate", signInLink: "Inicia sesión", appLanguage: "Idioma de la app",
};
const fr: Dict = {
  obTitle: "Adaptons LinguaScript à vous.", obSub: "Indiquez vos langues et votre niveau — cela alimente les traductions et les recommandations.",
  iSpeak: "Je parle (langue maternelle)", iLearn: "Je veux apprendre", howLearn: "Comment voulez-vous apprendre ?", myLevel: "Mon niveau actuel",
  totalBeginner: "Je suis grand débutant", schoolOptional: "Établissement (facultatif)", next: "Suivant", back: "Retour",
  startLearning: "Commencer", saving: "Enregistrement…", saveFailed: "Impossible d'enregistrer pour l'instant — vos choix sont conservés, réessayez bientôt.",
  welcomeBack: "Bon retour", joinLs: "Rejoindre LinguaScript", signInSub: "Connectez-vous pour continuer", signUpSub: "Créez votre compte pour commencer",
  google: "Continuer avec Google", signingIn: "Connexion…", or: "ou", displayName: "Nom affiché", email: "E-mail",
  password: "Mot de passe", signIn: "Se connecter", createAccount: "Créer un compte", loading: "Chargement...",
  noAccount: "Pas encore de compte ?", haveAccount: "Déjà un compte ?", signUp: "S'inscrire", signInLink: "Se connecter", appLanguage: "Langue de l'app",
};
const pt: Dict = {
  obTitle: "Vamos ajustar o LinguaScript para você.", obSub: "Conte seus idiomas e nível atual — isso melhora traduções e recomendações.",
  iSpeak: "Eu falo (nativo)", iLearn: "Quero aprender", howLearn: "Como você quer aprender?", myLevel: "Meu nível atual",
  totalBeginner: "Sou iniciante total", schoolOptional: "Escola (opcional)", next: "Próximo", back: "Voltar",
  startLearning: "Começar a aprender", saving: "Salvando…", saveFailed: "Não foi possível salvar agora — suas escolhas foram mantidas, tente de novo em instantes.",
  welcomeBack: "Bem-vindo de volta", joinLs: "Entre no LinguaScript", signInSub: "Entre para continuar aprendendo", signUpSub: "Crie sua conta para começar",
  google: "Continuar com Google", signingIn: "Entrando…", or: "ou", displayName: "Nome", email: "E-mail",
  password: "Senha", signIn: "Entrar", createAccount: "Criar conta", loading: "Carregando...",
  noAccount: "Não tem conta?", haveAccount: "Já tem conta?", signUp: "Cadastre-se", signInLink: "Entrar", appLanguage: "Idioma do app",
};
const ar: Dict = {
  obTitle: "لنضبط LinguaScript ليناسبك.", obSub: "أخبرنا بلغاتك ومستواك الحالي — هذا يحسّن الترجمات والاقتراحات.",
  iSpeak: "لغتي الأم", iLearn: "أريد أن أتعلم", howLearn: "كيف تريد أن تتعلم؟", myLevel: "مستواي الحالي",
  totalBeginner: "أنا مبتدئ تمامًا", schoolOptional: "المدرسة (اختياري)", next: "التالي", back: "رجوع",
  startLearning: "ابدأ التعلم", saving: "جارٍ الحفظ…", saveFailed: "تعذّر الحفظ الآن — اختياراتك محفوظة، حاول بعد قليل.",
  welcomeBack: "مرحبًا بعودتك", joinLs: "انضم إلى LinguaScript", signInSub: "سجّل الدخول لمتابعة التعلم", signUpSub: "أنشئ حسابك لتبدأ التعلم",
  google: "المتابعة باستخدام Google", signingIn: "جارٍ تسجيل الدخول…", or: "أو", displayName: "الاسم", email: "البريد الإلكتروني",
  password: "كلمة المرور", signIn: "تسجيل الدخول", createAccount: "إنشاء حساب", loading: "جارٍ التحميل...",
  noAccount: "ليس لديك حساب؟", haveAccount: "لديك حساب بالفعل؟", signUp: "إنشاء حساب", signInLink: "تسجيل الدخول", appLanguage: "لغة التطبيق",
};
const ko: Dict = {
  obTitle: "LinguaScript를 나에게 맞춰 볼까요?", obSub: "사용 언어와 현재 수준을 알려 주세요. 번역과 추천에 사용됩니다.",
  iSpeak: "모국어", iLearn: "배우고 싶은 언어", howLearn: "어떻게 배우고 싶나요?", myLevel: "현재 수준",
  totalBeginner: "완전 초보예요", schoolOptional: "학교 (선택)", next: "다음", back: "뒤로",
  startLearning: "학습 시작", saving: "저장 중…", saveFailed: "지금은 저장할 수 없어요. 선택은 유지되니 잠시 후 다시 시도해 주세요.",
  welcomeBack: "다시 오신 걸 환영해요", joinLs: "LinguaScript 가입", signInSub: "로그인하고 학습을 이어가세요", signUpSub: "계정을 만들고 학습을 시작하세요",
  google: "Google로 계속하기", signingIn: "로그인 중…", or: "또는", displayName: "이름", email: "이메일",
  password: "비밀번호", signIn: "로그인", createAccount: "계정 만들기", loading: "로딩 중...",
  noAccount: "계정이 없나요?", haveAccount: "이미 계정이 있나요?", signUp: "가입하기", signInLink: "로그인", appLanguage: "앱 언어",
};

export const STRINGS: Record<UiLang, Dict> & { en: typeof en } = { en, hi, zh, ja, ru, es, fr, pt, ar, ko };

export const UI_LANG_NAMES: Record<UiLang, string> = {
  en: "English", hi: "हिन्दी", zh: "中文", ja: "日本語", ru: "Русский",
  es: "Español", fr: "Français", pt: "Português", ar: "العربية", ko: "한국어",
};
