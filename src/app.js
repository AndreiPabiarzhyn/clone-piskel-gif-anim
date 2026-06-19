import { encodeGif, scaleFrame } from "./modules/gif.js";
import { reorderFrameCollections } from "./modules/frame-utils.js";
import { parseProject, stringifyProject } from "./modules/project-format.js";
import { blendPixels, compositeLayers } from "./modules/pixel-composite.js";
import { awardChallenge, CHALLENGES, levelFromXp, normalizeChallengeProgress, verifyChallenge } from "./modules/challenges.js";

const PALETTE = ["#f7d154", "#ed6473", "#5ccda4", "#5e9cff", "#af70e2", "#ff914a", "#ffffff", "#35313d"];
const SHAPE_TOOLS = new Set(["line", "rectangle", "ellipse"]);
const TOOL_TRANSLATION_KEYS = { select: "selection" };
const STORAGE_KEY = "pixel-motion-projects-v2";
const TRANSLATIONS = {
  ru: { import: "Импорт", new: "Новый", export: "Экспорт", spriteSheet: "Спрайтшит", projectFile: "Файл проекта", selection: "Выделение", layers: "Слои", recentProjects: "Недавние проекты", createProject: "Создать проект", layer: "Слой", saved: "Проект сохранён", imported: "Файл импортирован", projectImported: "Проект открыт", projectExported: "Файл проекта сохранён", invalidProject: "Не удалось открыть проект", project: "Проект", tools: "Инструменты", pencil: "Карандаш", eraser: "Ластик", fill: "Заливка", picker: "Пипетка", line: "Линия", rectangle: "Прямоугольник", ellipse: "Эллипс", color: "Цвет", brushSize: "Размер кисти", quickActions: "Быстрые действия", undo: "Отменить", clearFrame: "Очистить кадр", canvas: "Холст", grid: "Сетка", animation: "Анимация", preview: "Предпросмотр", speed: "Скорость", frames: "Кадры", duplicate: "Дублировать", copyFrame: "Копировать", pasteFrame: "Вставить", delete: "Удалить", newFrame: "Новый кадр", frameCopied: "Кадр скопирован", framePasted: "Кадр вставлен", emptyFrameClipboard: "Сначала скопируйте кадр" },
  en: { import: "Import", new: "New", export: "Export", spriteSheet: "Sprite sheet", projectFile: "Project file", selection: "Selection", layers: "Layers", recentProjects: "Recent projects", createProject: "Create project", layer: "Layer", saved: "Project saved", imported: "File imported", projectImported: "Project opened", projectExported: "Project file saved", invalidProject: "Could not open project", project: "Project", tools: "Tools", pencil: "Pencil", eraser: "Eraser", fill: "Fill", picker: "Color picker", line: "Line", rectangle: "Rectangle", ellipse: "Ellipse", color: "Color", brushSize: "Brush size", quickActions: "Quick actions", undo: "Undo", clearFrame: "Clear frame", canvas: "Canvas", grid: "Grid", animation: "Animation", preview: "Preview", speed: "Speed", frames: "Frames", duplicate: "Duplicate", copyFrame: "Copy", pasteFrame: "Paste", delete: "Delete", newFrame: "New frame", frameCopied: "Frame copied", framePasted: "Frame pasted", emptyFrameClipboard: "Copy a frame first" },
  pl: { import: "Importuj", new: "Nowy", export: "Eksport", spriteSheet: "Arkusz sprite'ów", projectFile: "Plik projektu", selection: "Zaznaczenie", layers: "Warstwy", recentProjects: "Ostatnie projekty", createProject: "Utwórz projekt", layer: "Warstwa", saved: "Projekt zapisany", imported: "Plik zaimportowany", projectImported: "Projekt otwarty", projectExported: "Plik projektu zapisany", invalidProject: "Nie udało się otworzyć projektu", project: "Projekt", tools: "Narzędzia", pencil: "Ołówek", eraser: "Gumka", fill: "Wypełnienie", picker: "Pipeta", line: "Linia", rectangle: "Prostokąt", ellipse: "Elipsa", color: "Kolor", brushSize: "Rozmiar pędzla", quickActions: "Szybkie akcje", undo: "Cofnij", clearFrame: "Wyczyść klatkę", canvas: "Płótno", grid: "Siatka", animation: "Animacja", preview: "Podgląd", speed: "Prędkość", frames: "Klatki", duplicate: "Duplikuj", copyFrame: "Kopiuj", pasteFrame: "Wklej", delete: "Usuń", newFrame: "Nowa klatka", frameCopied: "Klatka skopiowana", framePasted: "Klatka wklejona", emptyFrameClipboard: "Najpierw skopiuj klatkę" }
};
TRANSLATIONS.es = { ...TRANSLATIONS.en, import: "Importar", new: "Nuevo", export: "Exportar", spriteSheet: "Hoja de sprites", projectFile: "Archivo del proyecto", selection: "Selección", layers: "Capas", recentProjects: "Proyectos recientes", createProject: "Crear proyecto", layer: "Capa", saved: "Proyecto guardado", imported: "Archivo importado", projectImported: "Proyecto abierto", projectExported: "Archivo del proyecto guardado", invalidProject: "No se pudo abrir el proyecto", project: "Proyecto", tools: "Herramientas", pencil: "Lápiz", eraser: "Borrador", fill: "Relleno", picker: "Cuentagotas", line: "Línea", rectangle: "Rectángulo", ellipse: "Elipse", color: "Color", brushSize: "Tamaño del pincel", quickActions: "Acciones rápidas", undo: "Deshacer", clearFrame: "Limpiar fotograma", canvas: "Lienzo", grid: "Cuadrícula", animation: "Animación", preview: "Vista previa", speed: "Velocidad", frames: "Fotogramas", duplicate: "Duplicar", copyFrame: "Copiar", pasteFrame: "Pegar", delete: "Eliminar", newFrame: "Nuevo fotograma", frameCopied: "Fotograma copiado", framePasted: "Fotograma pegado", emptyFrameClipboard: "Primero copia un fotograma" };
TRANSLATIONS.tr = { ...TRANSLATIONS.en, import: "İçe aktar", new: "Yeni", export: "Dışa aktar", spriteSheet: "Sprite sayfası", projectFile: "Proje dosyası", selection: "Seçim", layers: "Katmanlar", recentProjects: "Son projeler", createProject: "Proje oluştur", layer: "Katman", saved: "Proje kaydedildi", imported: "Dosya içe aktarıldı", projectImported: "Proje açıldı", projectExported: "Proje dosyası kaydedildi", invalidProject: "Proje açılamadı", project: "Proje", tools: "Araçlar", pencil: "Kalem", eraser: "Silgi", fill: "Doldur", picker: "Damlalık", line: "Çizgi", rectangle: "Dikdörtgen", ellipse: "Elips", color: "Renk", brushSize: "Fırça boyutu", quickActions: "Hızlı işlemler", undo: "Geri al", clearFrame: "Kareyi temizle", canvas: "Tuval", grid: "Izgara", animation: "Animasyon", preview: "Önizleme", speed: "Hız", frames: "Kareler", duplicate: "Çoğalt", copyFrame: "Kopyala", pasteFrame: "Yapıştır", delete: "Sil", newFrame: "Yeni kare", frameCopied: "Kare kopyalandı", framePasted: "Kare yapıştırıldı", emptyFrameClipboard: "Önce bir kare kopyalayın" };
TRANSLATIONS.pt = { ...TRANSLATIONS.en, import: "Importar", new: "Novo", export: "Exportar", spriteSheet: "Folha de sprites", projectFile: "Arquivo do projeto", selection: "Seleção", layers: "Camadas", recentProjects: "Projetos recentes", createProject: "Criar projeto", layer: "Camada", saved: "Projeto salvo", imported: "Arquivo importado", projectImported: "Projeto aberto", projectExported: "Arquivo do projeto salvo", invalidProject: "Não foi possível abrir o projeto", project: "Projeto", tools: "Ferramentas", pencil: "Lápis", eraser: "Borracha", fill: "Preencher", picker: "Conta-gotas", line: "Linha", rectangle: "Retângulo", ellipse: "Elipse", color: "Cor", brushSize: "Tamanho do pincel", quickActions: "Ações rápidas", undo: "Desfazer", clearFrame: "Limpar quadro", canvas: "Tela", grid: "Grade", animation: "Animação", preview: "Pré-visualização", speed: "Velocidade", frames: "Quadros", duplicate: "Duplicar", copyFrame: "Copiar", pasteFrame: "Colar", delete: "Excluir", newFrame: "Novo quadro", frameCopied: "Quadro copiado", framePasted: "Quadro colado", emptyFrameClipboard: "Copie um quadro primeiro" };
TRANSLATIONS.id = { ...TRANSLATIONS.en, import: "Impor", new: "Baru", export: "Ekspor", spriteSheet: "Lembar sprite", projectFile: "Berkas proyek", selection: "Seleksi", layers: "Lapisan", recentProjects: "Proyek terbaru", createProject: "Buat proyek", layer: "Lapisan", saved: "Proyek disimpan", imported: "Berkas diimpor", projectImported: "Proyek dibuka", projectExported: "Berkas proyek disimpan", invalidProject: "Proyek tidak dapat dibuka", project: "Proyek", tools: "Alat", pencil: "Pensil", eraser: "Penghapus", fill: "Isi warna", picker: "Pipet warna", line: "Garis", rectangle: "Persegi panjang", ellipse: "Elips", color: "Warna", brushSize: "Ukuran kuas", quickActions: "Aksi cepat", undo: "Urungkan", clearFrame: "Bersihkan frame", canvas: "Kanvas", grid: "Kisi", animation: "Animasi", preview: "Pratinjau", speed: "Kecepatan", frames: "Frame", duplicate: "Duplikat", copyFrame: "Salin", pasteFrame: "Tempel", delete: "Hapus", newFrame: "Frame baru", frameCopied: "Frame disalin", framePasted: "Frame ditempel", emptyFrameClipboard: "Salin frame terlebih dahulu" };
Object.assign(TRANSLATIONS.ru, { untitledProject: "Моя анимация", frameLabel: "кадр", cycleLabel: "цикл", onionHelp: "Предыдущий кадр — красный, следующий — синий.", storyboard: "Раскадровка", newProject: "Новый проект", canvasSize: "Размер холста", sizeHelp: "Выберите заготовку или задайте свой размер от 8 до 128 пикселей.", width: "Ширина", height: "Высота", cancel: "Отмена" });
Object.assign(TRANSLATIONS.en, { untitledProject: "My animation", frameLabel: "frame", cycleLabel: "loop", onionHelp: "Previous frame is red, next frame is blue.", storyboard: "Storyboard", newProject: "New project", canvasSize: "Canvas size", sizeHelp: "Choose a preset or enter a custom size from 8 to 128 pixels.", width: "Width", height: "Height", cancel: "Cancel" });
Object.assign(TRANSLATIONS.pl, { untitledProject: "Moja animacja", frameLabel: "klatka", cycleLabel: "pętla", onionHelp: "Poprzednia klatka jest czerwona, następna niebieska.", storyboard: "Scenorys", newProject: "Nowy projekt", canvasSize: "Rozmiar płótna", sizeHelp: "Wybierz ustawienie lub podaj rozmiar od 8 do 128 pikseli.", width: "Szerokość", height: "Wysokość", cancel: "Anuluj" });
Object.assign(TRANSLATIONS.es, { untitledProject: "Mi animación", frameLabel: "fotograma", cycleLabel: "ciclo", onionHelp: "El fotograma anterior es rojo y el siguiente azul.", storyboard: "Guion gráfico", newProject: "Nuevo proyecto", canvasSize: "Tamaño del lienzo", sizeHelp: "Elige un tamaño o introduce uno de 8 a 128 píxeles.", width: "Ancho", height: "Alto", cancel: "Cancelar" });
Object.assign(TRANSLATIONS.tr, { untitledProject: "Animasyonum", frameLabel: "kare", cycleLabel: "döngü", onionHelp: "Önceki kare kırmızı, sonraki kare mavidir.", storyboard: "Hikâye panosu", newProject: "Yeni proje", canvasSize: "Tuval boyutu", sizeHelp: "Bir hazır boyut seçin veya 8–128 piksel arası girin.", width: "Genişlik", height: "Yükseklik", cancel: "İptal" });
Object.assign(TRANSLATIONS.pt, { untitledProject: "Minha animação", frameLabel: "quadro", cycleLabel: "ciclo", onionHelp: "O quadro anterior é vermelho e o próximo é azul.", storyboard: "Storyboard", newProject: "Novo projeto", canvasSize: "Tamanho da tela", sizeHelp: "Escolha um tamanho ou informe de 8 a 128 pixels.", width: "Largura", height: "Altura", cancel: "Cancelar" });
Object.assign(TRANSLATIONS.id, { untitledProject: "Animasi saya", frameLabel: "frame", cycleLabel: "siklus", onionHelp: "Frame sebelumnya merah, frame berikutnya biru.", storyboard: "Storyboard", newProject: "Proyek baru", canvasSize: "Ukuran kanvas", sizeHelp: "Pilih ukuran atau masukkan 8 hingga 128 piksel.", width: "Lebar", height: "Tinggi", cancel: "Batal" });
Object.assign(TRANSLATIONS.ru, { download: "Скачать", exportAnimation: "Скачать анимацию", animatedGif: "Анимированный GIF", gifDescription: "Все кадры, текущая скорость и прозрачный фон", pngDescription: "Текущий кадр", sheetDescription: "Все кадры одной полосой", projectDescription: "Для продолжения работы позже" });
Object.assign(TRANSLATIONS.en, { download: "Download", exportAnimation: "Download animation", animatedGif: "Animated GIF", gifDescription: "All frames, current speed and transparent background", pngDescription: "Current frame", sheetDescription: "All frames in one strip", projectDescription: "Continue editing later" });
Object.assign(TRANSLATIONS.pl, { download: "Pobierz", exportAnimation: "Pobierz animację", animatedGif: "Animowany GIF", gifDescription: "Wszystkie klatki, bieżąca prędkość i przezroczyste tło", pngDescription: "Bieżąca klatka", sheetDescription: "Wszystkie klatki w jednym pasku", projectDescription: "Kontynuuj edycję później" });
Object.assign(TRANSLATIONS.es, { download: "Descargar", exportAnimation: "Descargar animación", animatedGif: "GIF animado", gifDescription: "Todos los fotogramas, velocidad actual y fondo transparente", pngDescription: "Fotograma actual", sheetDescription: "Todos los fotogramas en una tira", projectDescription: "Continúa editando más tarde" });
Object.assign(TRANSLATIONS.tr, { download: "İndir", exportAnimation: "Animasyonu indir", animatedGif: "Animasyonlu GIF", gifDescription: "Tüm kareler, mevcut hız ve şeffaf arka plan", pngDescription: "Geçerli kare", sheetDescription: "Tüm kareler tek şeritte", projectDescription: "Daha sonra düzenlemeye devam et" });
Object.assign(TRANSLATIONS.pt, { download: "Baixar", exportAnimation: "Baixar animação", animatedGif: "GIF animado", gifDescription: "Todos os quadros, velocidade atual e fundo transparente", pngDescription: "Quadro atual", sheetDescription: "Todos os quadros em uma faixa", projectDescription: "Continue editando depois" });
Object.assign(TRANSLATIONS.id, { download: "Unduh", exportAnimation: "Unduh animasi", animatedGif: "GIF animasi", gifDescription: "Semua frame, kecepatan saat ini, dan latar transparan", pngDescription: "Frame saat ini", sheetDescription: "Semua frame dalam satu strip", projectDescription: "Lanjutkan penyuntingan nanti" });
Object.assign(TRANSLATIONS.ru, { downloadGif: "Скачать GIF" });
Object.assign(TRANSLATIONS.en, { downloadGif: "Download GIF" });
Object.assign(TRANSLATIONS.pl, { downloadGif: "Pobierz GIF" });
Object.assign(TRANSLATIONS.es, { downloadGif: "Descargar GIF" });
Object.assign(TRANSLATIONS.tr, { downloadGif: "GIF indir" });
Object.assign(TRANSLATIONS.pt, { downloadGif: "Baixar GIF" });
Object.assign(TRANSLATIONS.id, { downloadGif: "Unduh GIF" });
Object.assign(TRANSLATIONS.ru, { exportScale: "Размер экспорта", customScale: "Свой", scaleHint: "Увеличение без размытия, каждый пиксель остаётся чётким.", pngDescription: "Текущий кадр в выбранном масштабе", sheetDescription: "Все кадры одной полосой в выбранном масштабе" });
Object.assign(TRANSLATIONS.en, { exportScale: "Export size", customScale: "Custom", scaleHint: "Pixel-perfect scaling with no blur.", pngDescription: "Current frame at the selected scale", sheetDescription: "All frames in one strip at the selected scale" });
Object.assign(TRANSLATIONS.pl, { exportScale: "Rozmiar eksportu", customScale: "Własna", scaleHint: "Skalowanie bez rozmycia, piksele pozostają ostre.", pngDescription: "Bieżąca klatka w wybranej skali", sheetDescription: "Wszystkie klatki w jednym pasku w wybranej skali" });
Object.assign(TRANSLATIONS.es, { exportScale: "Tamaño de exportación", customScale: "Personalizado", scaleHint: "Escalado nítido sin desenfoque.", pngDescription: "Fotograma actual con la escala seleccionada", sheetDescription: "Todos los fotogramas con la escala seleccionada" });
Object.assign(TRANSLATIONS.tr, { exportScale: "Dışa aktarma boyutu", customScale: "Özel", scaleHint: "Bulanıklık olmadan piksel netliğinde ölçekleme.", pngDescription: "Seçilen ölçekte geçerli kare", sheetDescription: "Seçilen ölçekte tek şeritte tüm kareler" });
Object.assign(TRANSLATIONS.pt, { exportScale: "Tamanho da exportação", customScale: "Personalizado", scaleHint: "Ampliação sem desfoque, mantendo os pixels nítidos.", pngDescription: "Quadro atual na escala selecionada", sheetDescription: "Todos os quadros na escala selecionada" });
Object.assign(TRANSLATIONS.id, { exportScale: "Ukuran ekspor", customScale: "Kustom", scaleHint: "Penskalaan tajam tanpa buram.", pngDescription: "Frame saat ini pada skala terpilih", sheetDescription: "Semua frame pada skala terpilih" });
Object.assign(TRANSLATIONS.ru, { challenges: "Испытания", challengeHeading: "Испытания", challengeIntro: "Три бесплатных задания, которые научат рисовать пиксель-арт и анимацию.", checkChallenge: "Проверить", startChallenge: "Начать", free: "Бесплатно", completed: "Пройдено" });
Object.assign(TRANSLATIONS.en, { challenges: "Challenges", challengeHeading: "Challenges", challengeIntro: "Three free missions for learning pixel art and animation.", checkChallenge: "Check", startChallenge: "Start", free: "Free", completed: "Completed" });
Object.assign(TRANSLATIONS.pl, { challenges: "Wyzwania", challengeHeading: "Wyzwania", challengeIntro: "Trzy darmowe zadania do nauki pixel artu i animacji.", checkChallenge: "Sprawdź", startChallenge: "Zacznij", free: "Darmowe", completed: "Ukończono" });
Object.assign(TRANSLATIONS.es, { challenges: "Desafíos", challengeHeading: "Desafíos", challengeIntro: "Tres retos gratuitos para aprender pixel art y animación.", checkChallenge: "Comprobar", startChallenge: "Empezar", free: "Gratis", completed: "Completado" });
Object.assign(TRANSLATIONS.tr, { challenges: "Görevler", challengeHeading: "Görevler", challengeIntro: "Piksel sanatını ve animasyonu öğrenmek için üç ücretsiz görev.", checkChallenge: "Kontrol et", startChallenge: "Başla", free: "Ücretsiz", completed: "Tamamlandı" });
Object.assign(TRANSLATIONS.pt, { challenges: "Desafios", challengeHeading: "Desafios", challengeIntro: "Três desafios gratuitos para aprender pixel art e animação.", checkChallenge: "Verificar", startChallenge: "Começar", free: "Grátis", completed: "Concluído" });
Object.assign(TRANSLATIONS.id, { challenges: "Tantangan", challengeHeading: "Tantangan", challengeIntro: "Tiga tantangan gratis untuk belajar seni piksel dan animasi.", checkChallenge: "Periksa", startChallenge: "Mulai", free: "Gratis", completed: "Selesai" });
Object.assign(TRANSLATIONS.ru, { enlargeReference: "нажми на образец, чтобы увеличить", reference: "Образец", referenceScale: "Масштаб образца", referenceGrid: "Показывать сетку", fit: "Вписать" });
Object.assign(TRANSLATIONS.en, { enlargeReference: "click the reference to enlarge", reference: "Reference", referenceScale: "Reference scale", referenceGrid: "Show grid", fit: "Fit" });
Object.assign(TRANSLATIONS.pl, { enlargeReference: "kliknij wzór, aby powiększyć", reference: "Wzór", referenceScale: "Skala wzoru", referenceGrid: "Pokaż siatkę", fit: "Dopasuj" });
Object.assign(TRANSLATIONS.es, { enlargeReference: "pulsa el modelo para ampliarlo", reference: "Modelo", referenceScale: "Escala del modelo", referenceGrid: "Mostrar cuadrícula", fit: "Ajustar" });
Object.assign(TRANSLATIONS.tr, { enlargeReference: "büyütmek için örneğe tıkla", reference: "Örnek", referenceScale: "Örnek ölçeği", referenceGrid: "Izgarayı göster", fit: "Sığdır" });
Object.assign(TRANSLATIONS.pt, { enlargeReference: "clique no modelo para ampliar", reference: "Modelo", referenceScale: "Escala do modelo", referenceGrid: "Mostrar grade", fit: "Ajustar" });
Object.assign(TRANSLATIONS.id, { enlargeReference: "klik contoh untuk memperbesar", reference: "Contoh", referenceScale: "Skala contoh", referenceGrid: "Tampilkan kisi", fit: "Sesuaikan" });
Object.assign(TRANSLATIONS.ru, { artistLevel: "Уровень художника", winStreak: "серия побед", missionComplete: "Испытание пройдено", accuracy: "точность", reward: "награда", backToEditor: "В редактор", nextChallenge: "Следующее испытание" });
Object.assign(TRANSLATIONS.en, { artistLevel: "Artist level", winStreak: "win streak", missionComplete: "Challenge complete", accuracy: "accuracy", reward: "reward", backToEditor: "Back to editor", nextChallenge: "Next challenge" });
Object.assign(TRANSLATIONS.pl, { artistLevel: "Poziom artysty", winStreak: "seria zwycięstw", missionComplete: "Wyzwanie ukończone", accuracy: "dokładność", reward: "nagroda", backToEditor: "Do edytora", nextChallenge: "Następne wyzwanie" });
Object.assign(TRANSLATIONS.es, { artistLevel: "Nivel de artista", winStreak: "racha", missionComplete: "Desafío completado", accuracy: "precisión", reward: "recompensa", backToEditor: "Volver al editor", nextChallenge: "Siguiente desafío" });
Object.assign(TRANSLATIONS.tr, { artistLevel: "Sanatçı seviyesi", winStreak: "zafer serisi", missionComplete: "Görev tamamlandı", accuracy: "doğruluk", reward: "ödül", backToEditor: "Editöre dön", nextChallenge: "Sonraki görev" });
Object.assign(TRANSLATIONS.pt, { artistLevel: "Nível do artista", winStreak: "sequência", missionComplete: "Desafio concluído", accuracy: "precisão", reward: "recompensa", backToEditor: "Voltar ao editor", nextChallenge: "Próximo desafio" });
Object.assign(TRANSLATIONS.id, { artistLevel: "Level seniman", winStreak: "rentetan menang", missionComplete: "Tantangan selesai", accuracy: "akurasi", reward: "hadiah", backToEditor: "Kembali ke editor", nextChallenge: "Tantangan berikutnya" });
Object.assign(TRANSLATIONS.ru, { framePlan: "План по кадрам" });
Object.assign(TRANSLATIONS.en, { framePlan: "Frame plan" });
Object.assign(TRANSLATIONS.pl, { framePlan: "Plan klatek" });
Object.assign(TRANSLATIONS.es, { framePlan: "Plan de fotogramas" });
Object.assign(TRANSLATIONS.tr, { framePlan: "Kare planı" });
Object.assign(TRANSLATIONS.pt, { framePlan: "Plano de quadros" });
Object.assign(TRANSLATIONS.id, { framePlan: "Rencana frame" });
const $ = (selector) => document.querySelector(selector);
const canvas = $("#editorCanvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const gridCanvas = $("#gridOverlay");
const gridCtx = gridCanvas.getContext("2d");
const interactionCanvas = $("#interactionOverlay");
const interactionCtx = interactionCanvas.getContext("2d");
const brushCursor = $("#brushCursor");
const previewCanvas = $("#previewCanvas");
const previewCtx = previewCanvas.getContext("2d");

const state = {
  width: 32,
  height: 32,
  layers: [{ name: "Слой 1", visible: true, frames: [] }],
  activeLayer: 0,
  activeFrame: 0,
  tool: "pencil",
  color: "#f7d154",
  brushSize: 1,
  zoom: 16,
  fps: 8,
  playing: true,
  previewFrame: 0,
  drawing: false,
  lastPoint: null,
  gestureStart: null,
  gestureBase: null,
  onionSkin: false,
  gridVisible: true,
  autoFit: true,
  selection: null,
  movingSelection: false,
  history: [],
  clipboard: null,
  frameClipboard: null,
  draggedFrame: null,
  hoverPoint: null,
  canvasRect: null,
  editorBuffer: null,
  cursorFrame: 0,
  previewDirty: true,
  projectId: crypto.randomUUID(),
  language: "ru",
  activeChallenge: null,
  referenceZoom: 16,
  referenceFrame: 0,
  saveTimer: null,
  saveIdle: null
};

Object.defineProperty(state, "frames", {
  get() { return state.layers[state.activeLayer].frames; },
  set(frames) { state.layers[state.activeLayer].frames = frames; }
});

function createImage() {
  return new ImageData(state.width, state.height);
}

function cloneImage(image) {
  return new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
}

function resetProject(width, height) {
  state.width = width;
  state.height = height;
  state.layers = [{ name: `${t("layer")} 1`, visible: true, frames: [createImage()] }];
  state.activeLayer = 0;
  state.activeFrame = 0;
  state.previewFrame = 0;
  state.history = [];
  state.selection = null;
  state.activeChallenge = null;
  state.editorBuffer = null;
  state.projectId = crypto.randomUUID();
  canvas.width = width;
  canvas.height = height;
  previewCanvas.width = width;
  previewCanvas.height = height;
  fitZoom();
  render();
}

function saveHistory() {
  state.history.push({ frame: state.activeFrame, layer: state.activeLayer, image: cloneImage(state.frames[state.activeFrame]) });
  if (state.history.length > 50) state.history.shift();
}

function t(key) {
  return TRANSLATIONS[state.language]?.[key] || TRANSLATIONS.ru[key] || key;
}

function applyLanguage(language) {
  const currentName = $("#projectName")?.value;
  const usesDefaultName = Object.values(TRANSLATIONS).some((translation) => translation.untitledProject === currentName);
  state.language = TRANSLATIONS[language] ? language : "ru";
  document.documentElement.lang = state.language;
  $("#languageSelect").value = state.language;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll(".tool[data-tool]").forEach((button) => {
    const label = t(TOOL_TRANSLATION_KEYS[button.dataset.tool] || button.dataset.tool);
    button.dataset.tooltip = label;
    button.dataset.key = button.querySelector("kbd")?.textContent || "";
    button.setAttribute("aria-label", `${label} (${button.dataset.key})`);
  });
  localStorage.setItem("pixel-motion-language", state.language);
  if (usesDefaultName) $("#projectName").value = t("untitledProject");
  renderLayers();
  renderChallengeList();
  renderChallengeRunner();
}

function editorBuffer() {
  if (!state.editorBuffer || state.editorBuffer.width !== state.width || state.editorBuffer.height !== state.height) {
    state.editorBuffer = new ImageData(state.width, state.height);
  } else {
    state.editorBuffer.data.fill(0);
  }
  return state.editorBuffer;
}

function compositeFrame(frameIndex) {
  return new ImageData(compositeLayers(state.layers, frameIndex, state.width * state.height * 4), state.width, state.height);
}

function hexToRgba(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255, 255];
}

function samePixel(data, index, target) {
  return data[index] === target[0] && data[index + 1] === target[1] && data[index + 2] === target[2] && data[index + 3] === target[3];
}

function setPixel(image, x, y, color, size = state.brushSize) {
  for (let yy = y; yy < y + size; yy += 1) {
    for (let xx = x; xx < x + size; xx += 1) {
      if (xx < 0 || yy < 0 || xx >= state.width || yy >= state.height) continue;
      image.data.set(color, (yy * state.width + xx) * 4);
    }
  }
}

function fillAt(image, x, y, replacement) {
  const start = (y * state.width + x) * 4;
  const target = Array.from(image.data.slice(start, start + 4));
  if (target.every((value, index) => value === replacement[index])) return;
  const queue = [[x, y]];
  const visited = new Uint8Array(state.width * state.height);
  while (queue.length) {
    const [cx, cy] = queue.pop();
    if (cx < 0 || cy < 0 || cx >= state.width || cy >= state.height) continue;
    const position = cy * state.width + cx;
    if (visited[position]) continue;
    visited[position] = 1;
    const index = position * 4;
    if (!samePixel(image.data, index, target)) continue;
    image.data.set(replacement, index);
    queue.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
}

function drawLine(image, from, to, color) {
  let x0 = from.x;
  let y0 = from.y;
  const dx = Math.abs(to.x - x0);
  const dy = -Math.abs(to.y - y0);
  const sx = x0 < to.x ? 1 : -1;
  const sy = y0 < to.y ? 1 : -1;
  let error = dx + dy;
  while (true) {
    setPixel(image, x0, y0, color);
    if (x0 === to.x && y0 === to.y) break;
    const doubled = 2 * error;
    if (doubled >= dy) { error += dy; x0 += sx; }
    if (doubled <= dx) { error += dx; y0 += sy; }
  }
}

function drawRectangle(image, from, to, color) {
  drawLine(image, { x: from.x, y: from.y }, { x: to.x, y: from.y }, color);
  drawLine(image, { x: to.x, y: from.y }, { x: to.x, y: to.y }, color);
  drawLine(image, { x: to.x, y: to.y }, { x: from.x, y: to.y }, color);
  drawLine(image, { x: from.x, y: to.y }, { x: from.x, y: from.y }, color);
}

function drawEllipse(image, from, to, color) {
  const left = Math.min(from.x, to.x);
  const right = Math.max(from.x, to.x);
  const top = Math.min(from.y, to.y);
  const bottom = Math.max(from.y, to.y);
  const rx = Math.max((right - left) / 2, 0.5);
  const ry = Math.max((bottom - top) / 2, 0.5);
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;
  const steps = Math.max(12, Math.ceil(2 * Math.PI * Math.max(rx, ry) * 2));
  let previous = null;
  for (let i = 0; i <= steps; i += 1) {
    const angle = i / steps * Math.PI * 2;
    const point = { x: Math.round(cx + rx * Math.cos(angle)), y: Math.round(cy + ry * Math.sin(angle)) };
    if (previous) drawLine(image, previous, point, color);
    previous = point;
  }
}

function normalizedRect(from, to) {
  const x = Math.min(from.x, to.x);
  const y = Math.min(from.y, to.y);
  return { x, y, width: Math.abs(to.x - from.x) + 1, height: Math.abs(to.y - from.y) + 1 };
}

function pointInSelection(point) {
  const selection = state.selection;
  return selection && point.x >= selection.x && point.y >= selection.y &&
    point.x < selection.x + selection.width && point.y < selection.y + selection.height;
}

function moveSelection(point) {
  const source = state.gestureBase;
  const selection = state.selection;
  const targetX = Math.max(0, Math.min(state.width - selection.width, selection.x + point.x - state.gestureStart.x));
  const targetY = Math.max(0, Math.min(state.height - selection.height, selection.y + point.y - state.gestureStart.y));
  const dx = targetX - selection.x;
  const dy = targetY - selection.y;
  const result = cloneImage(source);
  const pixels = [];

  for (let y = 0; y < selection.height; y += 1) {
    for (let x = 0; x < selection.width; x += 1) {
      const sx = selection.x + x;
      const sy = selection.y + y;
      const sourceIndex = (sy * state.width + sx) * 4;
      pixels.push(Array.from(source.data.slice(sourceIndex, sourceIndex + 4)));
      result.data.set([0, 0, 0, 0], sourceIndex);
    }
  }
  for (let y = 0; y < selection.height; y += 1) {
    for (let x = 0; x < selection.width; x += 1) {
      const tx = selection.x + dx + x;
      const ty = selection.y + dy + y;
      if (tx < 0 || ty < 0 || tx >= state.width || ty >= state.height) continue;
      result.data.set(pixels[y * selection.width + x], (ty * state.width + tx) * 4);
    }
  }
  state.frames[state.activeFrame] = result;
  state.pendingSelection = { ...selection, x: targetX, y: targetY };
}

function pointFromEvent(event) {
  const rect = state.canvasRect || canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(state.width - 1, Math.floor((event.clientX - rect.left) / rect.width * state.width))),
    y: Math.max(0, Math.min(state.height - 1, Math.floor((event.clientY - rect.top) / rect.height * state.height)))
  };
}

function updateCanvasRect() {
  state.canvasRect = canvas.getBoundingClientRect();
}

function pauseAutosaveWhileDrawing() {
  clearTimeout(state.saveTimer);
  if (state.saveIdle && "cancelIdleCallback" in window) {
    cancelIdleCallback(state.saveIdle);
    state.saveIdle = null;
  }
}

function startPaint(event) {
  pauseAutosaveWhileDrawing();
  const point = pointFromEvent(event);
  const effectiveTool = event.buttons === 2 ? "eraser" : state.tool;
  if (!state.layers[state.activeLayer].visible && effectiveTool !== "picker" && effectiveTool !== "select") {
    state.layers[state.activeLayer].visible = true;
  }
  state.drawing = true;
  state.lastPoint = point;
  state.gestureStart = point;
  state.gestureBase = cloneImage(state.frames[state.activeFrame]);
  state.pendingSelection = null;

  if (effectiveTool === "picker") {
    const image = state.frames[state.activeFrame];
    const index = (point.y * state.width + point.x) * 4;
    if (image.data[index + 3]) {
      state.color = `#${[0, 1, 2].map((offset) => image.data[index + offset].toString(16).padStart(2, "0")).join("")}`;
      $("#colorPicker").value = state.color;
      $("#colorHex").value = state.color.toUpperCase();
    }
    state.drawing = false;
    return;
  }

  if (effectiveTool === "fill") {
    saveHistory();
    fillAt(state.frames[state.activeFrame], point.x, point.y, hexToRgba(state.color));
    state.drawing = false;
  } else if (effectiveTool === "select") {
    state.movingSelection = pointInSelection(point);
    if (state.movingSelection) {
      state.layers[state.activeLayer].visible = true;
      saveHistory();
    }
    else state.selection = normalizedRect(point, point);
  } else if (SHAPE_TOOLS.has(effectiveTool)) {
    saveHistory();
    setPixel(state.frames[state.activeFrame], point.x, point.y, hexToRgba(state.color));
  } else if (!SHAPE_TOOLS.has(effectiveTool)) {
    saveHistory();
    setPixel(state.frames[state.activeFrame], point.x, point.y, effectiveTool === "eraser" ? [0, 0, 0, 0] : hexToRgba(state.color));
  }
  if (state.drawing) renderEditor();
  else render();
}

function continuePaint(event) {
  if (!state.drawing) return;
  const point = pointFromEvent(event);
  state.hoverPoint = point;
  const effectiveTool = event.buttons === 2 ? "eraser" : state.tool;
  const color = effectiveTool === "eraser" ? [0, 0, 0, 0] : hexToRgba(state.color);

  if (SHAPE_TOOLS.has(effectiveTool)) {
    const image = cloneImage(state.gestureBase);
    if (effectiveTool === "line") drawLine(image, state.gestureStart, point, color);
    if (effectiveTool === "rectangle") drawRectangle(image, state.gestureStart, point, color);
    if (effectiveTool === "ellipse") drawEllipse(image, state.gestureStart, point, color);
    state.frames[state.activeFrame] = image;
  } else if (effectiveTool === "select") {
    if (state.movingSelection) moveSelection(point);
    else state.selection = normalizedRect(state.gestureStart, point);
  } else {
    drawLine(state.frames[state.activeFrame], state.lastPoint, point, color);
    state.lastPoint = point;
  }
  renderEditor();
  scheduleBrushCursor();
}

function endPaint() {
  if (state.movingSelection && state.pendingSelection) state.selection = state.pendingSelection;
  state.drawing = false;
  state.movingSelection = false;
  state.lastPoint = null;
  state.gestureBase = null;
  state.pendingSelection = null;
  render();
}

function renderEditor() {
  const display = editorBuffer();
  if (state.onionSkin && state.activeFrame > 0) {
    blendPixels(display.data, compositeFrame(state.activeFrame - 1).data, [255, 82, 103], 75 / 255);
  }
  if (state.onionSkin && state.activeFrame < state.layers[0].frames.length - 1) {
    blendPixels(display.data, compositeFrame(state.activeFrame + 1).data, [79, 156, 255], 75 / 255);
  }
  state.layers.forEach((layer) => {
    if (layer.visible && layer.frames[state.activeFrame]) blendPixels(display.data, layer.frames[state.activeFrame].data);
  });
  ctx.putImageData(display, 0, 0);
  renderInteraction();
}

function renderFrames() {
  const host = $("#frames");
  host.innerHTML = "";
  state.layers[0].frames.forEach((_, index) => {
    const button = document.createElement("button");
    button.className = `frame${index === state.activeFrame ? " active" : ""}`;
    button.title = `Кадр ${index + 1}`;
    button.draggable = true;
    button.dataset.frameIndex = index;
    const thumb = document.createElement("canvas");
    thumb.width = state.width;
    thumb.height = state.height;
    thumb.getContext("2d").putImageData(compositeFrame(index), 0, 0);
    const number = document.createElement("span");
    number.className = "frame-number";
    number.textContent = String(index + 1).padStart(2, "0");
    button.append(thumb, number);
    button.addEventListener("click", () => {
      state.activeFrame = index;
      state.selection = null;
      render();
    });
    button.addEventListener("dragstart", (event) => {
      state.draggedFrame = index;
      button.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(index));
    });
    button.addEventListener("dragend", () => {
      state.draggedFrame = null;
      document.querySelectorAll(".frame").forEach((frame) => frame.classList.remove("dragging", "drop-before", "drop-after"));
    });
    button.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (state.draggedFrame === null || state.draggedFrame === index) return;
      const after = event.clientX > button.getBoundingClientRect().left + button.offsetWidth / 2;
      button.classList.toggle("drop-before", !after);
      button.classList.toggle("drop-after", after);
      event.dataTransfer.dropEffect = "move";
    });
    button.addEventListener("dragleave", () => button.classList.remove("drop-before", "drop-after"));
    button.addEventListener("drop", (event) => {
      event.preventDefault();
      const from = Number(event.dataTransfer.getData("text/plain"));
      const after = event.clientX > button.getBoundingClientRect().left + button.offsetWidth / 2;
      reorderFrame(from, index + (after ? 1 : 0));
    });
    host.append(button);
  });
}

function updateStats() {
  const count = state.layers[0].frames.length;
  $("#frameCount").textContent = count;
  $("#duration").textContent = `${(count / state.fps).toFixed(2)}с`;
  $("#deleteFrame").disabled = count === 1;
  $("#canvasDimensions").textContent = `${state.width} × ${state.height} px`;
}

function render() {
  renderEditor();
  renderFrames();
  renderLayers();
  updateStats();
  renderChallengeRunner();
  state.previewDirty = true;
  scheduleAutosave();
}

function setTool(tool) {
  state.tool = tool;
  state.selection = tool === "select" ? state.selection : null;
  $("#selectionActions").hidden = tool !== "select";
  document.querySelectorAll(".tool").forEach((button) => button.classList.toggle("active", button.dataset.tool === tool));
  const hints = {
    select: "Протяните рамку, затем перетащите выделенные пиксели",
    line: "Протяните от начала до конца линии",
    rectangle: "Протяните между противоположными углами",
    ellipse: "Протяните область будущего эллипса"
  };
  $("#toolHint").innerHTML = `<span>✦</span> ${hints[tool] || "Рисуйте мышью или касанием · правая кнопка — ластик"}`;
  canvas.style.cursor = ["pencil", "eraser"].includes(tool) ? "none" : tool === "select" ? "cell" : "crosshair";
  scheduleBrushCursor();
  renderEditor();
}

function addFrame(copy = false) {
  state.layers.forEach((layer) => {
    const source = layer.frames[state.activeFrame];
    layer.frames.splice(state.activeFrame + 1, 0, copy ? cloneImage(source) : createImage());
  });
  state.activeFrame += 1;
  state.selection = null;
  render();
  document.querySelector(`.frame[data-frame-index="${state.activeFrame}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
}

function reorderFrame(from, insertionIndex) {
  const to = reorderFrameCollections(state.layers.map((layer) => layer.frames), from, insertionIndex);
  if (to === from) return;
  state.activeFrame = to;
  state.previewFrame = to;
  state.selection = null;
  state.draggedFrame = null;
  render();
  document.querySelector(`.frame[data-frame-index="${to}"]`)?.scrollIntoView({ behavior: "smooth", inline: "nearest" });
}

function copyWholeFrame() {
  state.frameClipboard = state.layers.map((layer) => cloneImage(layer.frames[state.activeFrame]));
  showToast(t("frameCopied"));
}

function pasteWholeFrame() {
  if (!state.frameClipboard) return showToast(t("emptyFrameClipboard"));
  const insertion = state.activeFrame + 1;
  state.layers.forEach((layer, index) => {
    const copied = state.frameClipboard[index];
    layer.frames.splice(insertion, 0, copied ? cloneImage(copied) : createImage());
  });
  state.activeFrame = insertion;
  state.previewFrame = insertion;
  state.selection = null;
  render();
  document.querySelector(`.frame[data-frame-index="${insertion}"]`)?.scrollIntoView({ behavior: "smooth", inline: "nearest" });
  showToast(t("framePasted"));
}

function deleteFrame() {
  if (state.layers[0].frames.length === 1) return;
  state.layers.forEach((layer) => layer.frames.splice(state.activeFrame, 1));
  state.activeFrame = Math.min(state.activeFrame, state.layers[0].frames.length - 1);
  state.selection = null;
  render();
}

function clearFrame() {
  saveHistory();
  state.frames[state.activeFrame] = createImage();
  state.selection = null;
  render();
}

function clearSelection() {
  if (!state.selection) return clearFrame();
  clearSelectionPixels();
  state.selection = null;
  render();
}

function undo() {
  const previous = state.history.pop();
  if (!previous) return showToast("Нечего отменять");
  state.activeLayer = previous.layer;
  state.frames[previous.frame] = previous.image;
  state.activeFrame = previous.frame;
  state.selection = null;
  render();
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 1800);
}

function exportGif() {
  const scale = exportScale();
  const frames = state.layers[0].frames.map((_, index) => scaleFrame(compositeFrame(index), state.width, state.height, scale));
  const width = state.width * scale;
  const height = state.height * scale;
  const bytes = encodeGif(frames, width, height, state.fps);
  const blob = new Blob([bytes], { type: "image/gif" });
  const link = document.createElement("a");
  const name = $("#projectName").value.trim().replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-|-$/g, "") || "pixel-motion";
  link.href = URL.createObjectURL(blob);
  link.download = `${name}.gif`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  showToast("GIF готов к скачиванию");
}

function downloadCanvas(surface, suffix) {
  surface.toBlob((blob) => {
    const link = document.createElement("a");
    const name = $("#projectName").value.trim().replace(/[^\p{L}\p{N}_-]+/gu, "-") || "pixel-motion";
    link.href = URL.createObjectURL(blob);
    link.download = `${name}${suffix}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }, "image/png");
}

function exportPng() {
  const scale = exportScale();
  const frame = scaleFrame(compositeFrame(state.activeFrame), state.width, state.height, scale);
  const surface = document.createElement("canvas");
  surface.width = state.width * scale;
  surface.height = state.height * scale;
  surface.getContext("2d").putImageData(new ImageData(frame.data, surface.width, surface.height), 0, 0);
  downloadCanvas(surface, "");
}

function exportSpriteSheet() {
  const scale = exportScale();
  const count = state.layers[0].frames.length;
  const surface = document.createElement("canvas");
  surface.width = state.width * scale * count;
  surface.height = state.height * scale;
  const surfaceCtx = surface.getContext("2d");
  for (let index = 0; index < count; index += 1) {
    const frame = scaleFrame(compositeFrame(index), state.width, state.height, scale);
    const frameCanvas = document.createElement("canvas");
    frameCanvas.width = state.width * scale;
    frameCanvas.height = state.height * scale;
    frameCanvas.getContext("2d").putImageData(new ImageData(frame.data, frameCanvas.width, frameCanvas.height), 0, 0);
    surfaceCtx.drawImage(frameCanvas, index * frameCanvas.width, 0);
  }
  downloadCanvas(surface, "-spritesheet");
}

function renderLayers() {
  const host = $("#layersList");
  if (!host) return;
  host.innerHTML = "";
  [...state.layers].reverse().forEach((layer, reverseIndex) => {
    const index = state.layers.length - reverseIndex - 1;
    const item = document.createElement("div");
    item.className = `layer-item${index === state.activeLayer ? " active" : ""}`;
    const visibility = document.createElement("button");
    visibility.textContent = layer.visible ? "●" : "○";
    visibility.title = layer.visible ? "Hide" : "Show";
    visibility.addEventListener("click", () => {
      layer.visible = !layer.visible;
      render();
    });
    const name = document.createElement("span");
    name.textContent = layer.name;
    name.addEventListener("click", () => {
      state.activeLayer = index;
      state.selection = null;
      render();
    });
    name.addEventListener("dblclick", () => {
      const next = window.prompt("Layer name", layer.name);
      if (next?.trim()) {
        layer.name = next.trim();
        render();
      }
    });
    const up = document.createElement("button");
    up.textContent = "↑";
    up.disabled = index === state.layers.length - 1;
    up.addEventListener("click", () => {
      if (index >= state.layers.length - 1) return;
      [state.layers[index], state.layers[index + 1]] = [state.layers[index + 1], state.layers[index]];
      state.activeLayer = index + 1;
      render();
    });
    const down = document.createElement("button");
    down.textContent = "↓";
    down.disabled = index === 0;
    down.addEventListener("click", () => {
      if (index <= 0) return;
      [state.layers[index], state.layers[index - 1]] = [state.layers[index - 1], state.layers[index]];
      state.activeLayer = index - 1;
      render();
    });
    const remove = document.createElement("button");
    remove.textContent = "×";
    remove.disabled = state.layers.length === 1;
    remove.addEventListener("click", () => {
      if (state.layers.length === 1) return;
      state.layers.splice(index, 1);
      if (index < state.activeLayer) state.activeLayer -= 1;
      else state.activeLayer = Math.min(state.activeLayer, state.layers.length - 1);
      render();
    });
    item.append(visibility, name, up, down, remove);
    host.append(item);
  });
}

function addLayer() {
  const frameCount = state.layers[0].frames.length;
  state.layers.push({
    name: `${t("layer")} ${state.layers.length + 1}`,
    visible: true,
    frames: Array.from({ length: frameCount }, () => createImage())
  });
  state.activeLayer = state.layers.length - 1;
  render();
}

function selectionImage() {
  if (!state.selection) return null;
  const result = new ImageData(state.selection.width, state.selection.height);
  const source = state.frames[state.activeFrame];
  for (let y = 0; y < state.selection.height; y += 1) {
    for (let x = 0; x < state.selection.width; x += 1) {
      const sourceIndex = ((state.selection.y + y) * state.width + state.selection.x + x) * 4;
      result.data.set(source.data.slice(sourceIndex, sourceIndex + 4), (y * result.width + x) * 4);
    }
  }
  return result;
}

function copySelection() {
  const image = selectionImage();
  if (!image) return showToast("Сначала выделите область");
  state.clipboard = cloneImage(image);
  showToast("Выделение скопировано");
}

function pasteSelection() {
  if (!state.clipboard) return showToast("Буфер пуст");
  saveHistory();
  const x = state.selection?.x || 0;
  const y = state.selection?.y || 0;
  const image = state.frames[state.activeFrame];
  for (let yy = 0; yy < state.clipboard.height; yy += 1) {
    for (let xx = 0; xx < state.clipboard.width; xx += 1) {
      const tx = x + xx;
      const ty = y + yy;
      if (tx >= state.width || ty >= state.height) continue;
      const sourceIndex = (yy * state.clipboard.width + xx) * 4;
      image.data.set(state.clipboard.data.slice(sourceIndex, sourceIndex + 4), (ty * state.width + tx) * 4);
    }
  }
  state.selection = { x, y, width: Math.min(state.clipboard.width, state.width - x), height: Math.min(state.clipboard.height, state.height - y) };
  setTool("select");
  render();
}

function transformSelection(type) {
  const source = selectionImage();
  if (!source) return showToast("Сначала выделите область");
  saveHistory();
  const rotate = type === "rotate";
  const result = new ImageData(rotate ? source.height : source.width, rotate ? source.width : source.height);
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      let tx = x;
      let ty = y;
      if (type === "rotate") { tx = source.height - 1 - y; ty = x; }
      if (type === "flipX") tx = source.width - 1 - x;
      if (type === "flipY") ty = source.height - 1 - y;
      result.data.set(source.data.slice((y * source.width + x) * 4, (y * source.width + x) * 4 + 4), (ty * result.width + tx) * 4);
    }
  }
  clearSelectionPixels(false);
  state.clipboard = result;
  pasteSelectionAt(result, state.selection.x, state.selection.y);
  state.selection.width = Math.min(result.width, state.width - state.selection.x);
  state.selection.height = Math.min(result.height, state.height - state.selection.y);
  render();
}

function pasteSelectionAt(source, x, y) {
  const image = state.frames[state.activeFrame];
  for (let yy = 0; yy < source.height; yy += 1) {
    for (let xx = 0; xx < source.width; xx += 1) {
      if (x + xx >= state.width || y + yy >= state.height) continue;
      const index = (yy * source.width + xx) * 4;
      image.data.set(source.data.slice(index, index + 4), ((y + yy) * state.width + x + xx) * 4);
    }
  }
}

function clearSelectionPixels(save = true) {
  if (!state.selection) return;
  if (save) saveHistory();
  const image = state.frames[state.activeFrame];
  for (let y = state.selection.y; y < state.selection.y + state.selection.height; y += 1) {
    for (let x = state.selection.x; x < state.selection.x + state.selection.width; x += 1) {
      image.data.set([0, 0, 0, 0], (y * state.width + x) * 4);
    }
  }
}

function serializeProject() {
  return {
    id: state.projectId,
    name: $("#projectName").value.trim() || "Pixel Motion",
    width: state.width,
    height: state.height,
    fps: state.fps,
    updatedAt: Date.now(),
    layers: state.layers.map((layer) => ({
      name: layer.name,
      visible: layer.visible,
      frames: layer.frames.map((frame) => Array.from(frame.data))
    }))
  };
}

function safeFileName(value) {
  return value.trim().replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-|-$/g, "") || "pixel-motion";
}

function exportProjectFile() {
  const text = stringifyProject(serializeProject(), "1.0.0");
  const blob = new Blob([text], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${safeFileName($("#projectName").value)}.pixelmotion`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  showToast(t("projectExported"));
}

async function importProjectFile(file) {
  const project = parseProject(await file.text());
  project.id = crypto.randomUUID();
  project.updatedAt = Date.now();
  loadProject(project);
  scheduleAutosave();
  showToast(t("projectImported"));
}

function getProjects() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}

function deleteSavedProject(projectId) {
  const project = getProjects().find((item) => item.id === projectId);
  if (!project) return;
  const message = state.language === "pl"
    ? `Usunąć projekt „${project.name}”?`
    : state.language === "en"
      ? `Delete project “${project.name}”?`
      : `Удалить проект «${project.name}»?`;
  if (!window.confirm(message)) return;

  clearTimeout(state.saveTimer);
  const projects = getProjects().filter((item) => item.id !== projectId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  if (state.projectId === projectId) state.projectId = crypto.randomUUID();
  renderRecentProjects();
  showToast(state.language === "pl" ? "Projekt usunięty" : state.language === "en" ? "Project deleted" : "Проект удалён");
}

function scheduleAutosave() {
  clearTimeout(state.saveTimer);
  if (state.saveIdle && "cancelIdleCallback" in window) cancelIdleCallback(state.saveIdle);
  state.saveTimer = setTimeout(() => {
    const save = () => {
      state.saveIdle = null;
      const projects = getProjects().filter((project) => project.id !== state.projectId);
      projects.unshift(serializeProject());
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(projects.slice(0, 8))); }
      catch { showToast("Недостаточно места для автосохранения"); }
    };
    if ("requestIdleCallback" in window) state.saveIdle = requestIdleCallback(save, { timeout: 1500 });
    else save();
  }, 500);
}

function loadProject(project) {
  state.activeChallenge = null;
  state.width = project.width;
  state.height = project.height;
  state.fps = project.fps || 8;
  state.projectId = project.id;
  state.layers = project.layers.map((layer) => ({
    name: layer.name,
    visible: layer.visible,
    frames: layer.frames.map((data) => new ImageData(new Uint8ClampedArray(data), project.width, project.height))
  }));
  state.activeLayer = 0;
  state.activeFrame = 0;
  state.editorBuffer = null;
  canvas.width = state.width;
  canvas.height = state.height;
  previewCanvas.width = state.width;
  previewCanvas.height = state.height;
  $("#projectName").value = project.name;
  $("#fpsRange").value = state.fps;
  $("#fpsValue").value = `${state.fps} FPS`;
  fitZoom();
  render();
}

function renderRecentProjects() {
  const host = $("#recentProjects");
  host.innerHTML = "";
  const projects = getProjects();
  if (!projects.length) {
    host.innerHTML = `<p class="dialog-copy">${state.language === "pl" ? "Brak zapisanych projektów." : state.language === "en" ? "No saved projects yet." : "Сохранённых проектов пока нет."}</p>`;
    return;
  }
  projects.forEach((project) => {
    const card = document.createElement("div");
    card.className = "project-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    const remove = document.createElement("button");
    remove.className = "delete-project";
    remove.type = "button";
    remove.textContent = "×";
    remove.title = state.language === "pl" ? "Usuń projekt" : state.language === "en" ? "Delete project" : "Удалить проект";
    remove.setAttribute("aria-label", remove.title);
    remove.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteSavedProject(project.id);
    });
    const thumb = document.createElement("canvas");
    thumb.width = project.width;
    thumb.height = project.height;
    const topLayer = project.layers.at(-1);
    if (topLayer?.frames[0]) thumb.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(topLayer.frames[0]), project.width, project.height), 0, 0);
    const title = document.createElement("strong");
    title.textContent = project.name;
    const date = document.createElement("small");
    date.textContent = new Date(project.updatedAt).toLocaleString(state.language);
    card.append(remove, thumb, title, date);
    const openProject = () => {
      loadProject(project);
      $("#projectsDialog").close();
    };
    card.addEventListener("click", openProject);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openProject();
      }
    });
    host.append(card);
  });
}

const CHALLENGE_PROGRESS_KEY = "pixel-motion-challenges-v1";

function challengeProgress() {
  try {
    return normalizeChallengeProgress(JSON.parse(localStorage.getItem(CHALLENGE_PROGRESS_KEY) || "{}"));
  } catch {
    return normalizeChallengeProgress({});
  }
}

function saveChallengeProgress(progress) {
  localStorage.setItem(CHALLENGE_PROGRESS_KEY, JSON.stringify(progress));
}

function rankName(level) {
  if (state.language !== "ru") return level >= 5 ? "Pixel Master" : level >= 3 ? "Animator" : level >= 2 ? "Pixel Artist" : "Rookie";
  return level >= 5 ? "Мастер пикселей" : level >= 3 ? "Аниматор" : level >= 2 ? "Пиксель-художник" : "Новичок";
}

function renderChallengeProfile(progress = challengeProgress()) {
  const level = levelFromXp(progress.xp);
  $("#challengePlayerLevel").textContent = level.level;
  $("#challengeRankName").textContent = rankName(level.level);
  $("#challengeXpLabel").value = `${level.current} / ${level.target}`;
  $("#challengeXpBar").style.width = `${level.progress * 100}%`;
  $("#challengeStreak").textContent = progress.streak;
}

function drawChallengeTemplate(surface, challenge, template = challenge.template) {
  surface.width = challenge.width;
  surface.height = challenge.height;
  const context = surface.getContext("2d");
  context.clearRect(0, 0, surface.width, surface.height);
  context.putImageData(new ImageData(new Uint8ClampedArray(template), challenge.width, challenge.height), 0, 0);
}

function renderChallengeList() {
  const host = $("#challengeList");
  if (!host) return;
  const progress = challengeProgress();
  renderChallengeProfile(progress);
  host.innerHTML = "";
  CHALLENGES.forEach((challenge) => {
    const completion = progress.completed[challenge.id];
    const card = document.createElement("article");
    card.className = `challenge-card${completion ? " completed" : ""}`;
    const reward = document.createElement("span");
    reward.className = "challenge-card-reward";
    reward.textContent = completion ? `★ ${completion.bestScore}%` : `+${challenge.reward} XP`;
    const preview = document.createElement("div");
    preview.className = "challenge-preview";
    const templates = challenge.frameTemplates || [challenge.template];
    templates.forEach((frameTemplate, index) => {
      const template = document.createElement("canvas");
      drawChallengeTemplate(template, challenge, frameTemplate);
      if (templates.length > 1) {
        const frame = document.createElement("span");
        frame.dataset.frame = index + 1;
        frame.append(template);
        preview.append(frame);
      } else {
        preview.append(template);
      }
    });
    preview.classList.toggle("sequence", templates.length > 1);
    const meta = document.createElement("div");
    meta.className = "challenge-card-meta";
    meta.innerHTML = `<span>${state.language === "ru" ? "Уровень" : "Level"} ${challenge.level}</span><span class="challenge-free">${completion ? t("completed") : t("free")}</span>`;
    const title = document.createElement("h3");
    title.textContent = challenge.title;
    const description = document.createElement("p");
    description.textContent = challenge.description;
    const rules = document.createElement("div");
    rules.className = "challenge-rules";
    challenge.rules.forEach((rule) => {
      const item = document.createElement("span");
      item.textContent = rule;
      rules.append(item);
    });
    const start = document.createElement("button");
    start.className = "challenge-start";
    start.textContent = completion && state.language === "ru" ? "Улучшить результат" : t("startChallenge");
    start.addEventListener("click", () => startChallenge(challenge));
    card.append(reward, preview, meta, title, description, rules, start);
    host.append(card);
  });
}

function renderChallengeRunner() {
  const runner = $("#challengeRunner");
  if (!runner) return;
  const challenge = state.activeChallenge;
  runner.closest(".canvas-stage").classList.toggle("challenge-active", Boolean(challenge));
  runner.hidden = !challenge;
  if (!challenge) return;
  const targetFrame = challenge.frameTemplates?.[Math.min(state.activeFrame, challenge.frameTemplates.length - 1)] || challenge.template;
  drawChallengeTemplate($("#challengeReference"), challenge, targetFrame);
  $("#challengeLevel").textContent = `${state.language === "ru" ? "Испытание" : "Challenge"} ${challenge.level} / ${CHALLENGES.length}`;
  $("#challengeTitle").textContent = challenge.title;
  $("#challengeGoal").textContent = challenge.frameTemplates
    ? `${state.language === "ru" ? "Сейчас рисуем кадр" : "Current target frame"} ${Math.min(state.activeFrame + 1, challenge.frameTemplates.length)} / ${challenge.frameTemplates.length}`
    : challenge.subtitle;
  const guide = $("#challengeFrameGuide");
  guide.hidden = !challenge.frameTemplates;
  guide.innerHTML = "";
  challenge.frameTemplates?.forEach((template, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = index === state.activeFrame ? "active" : "";
    button.title = `${state.language === "ru" ? "Кадр" : "Frame"} ${index + 1}`;
    const canvas = document.createElement("canvas");
    drawChallengeTemplate(canvas, challenge, template);
    const number = document.createElement("b");
    number.textContent = index + 1;
    button.append(canvas, number);
    button.addEventListener("click", () => {
      state.referenceFrame = index;
      openChallengeReference();
    });
    guide.append(button);
  });
}

function renderLargeChallengeReference() {
  const challenge = state.activeChallenge;
  if (!challenge) return;
  const surface = $("#largeChallengeReference");
  const template = challenge.frameTemplates?.[state.referenceFrame] || challenge.template;
  drawChallengeTemplate(surface, challenge, template);
  const displayWidth = challenge.width * state.referenceZoom;
  const displayHeight = challenge.height * state.referenceZoom;
  surface.style.width = `${displayWidth}px`;
  surface.style.height = `${displayHeight}px`;
  surface.style.backgroundSize = `${state.referenceZoom * 2}px ${state.referenceZoom * 2}px`;
  surface.style.backgroundPosition = `0 0, 0 ${state.referenceZoom}px, ${state.referenceZoom}px -${state.referenceZoom}px, -${state.referenceZoom}px 0`;

  const grid = $("#challengeReferenceGrid");
  const ratio = window.devicePixelRatio || 1;
  grid.width = Math.round(displayWidth * ratio);
  grid.height = Math.round(displayHeight * ratio);
  grid.style.width = `${displayWidth}px`;
  grid.style.height = `${displayHeight}px`;
  const context = grid.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, displayWidth, displayHeight);
  grid.hidden = !$("#referenceGridVisible").checked;
  if (!grid.hidden) {
    context.beginPath();
    context.strokeStyle = "rgba(12, 11, 14, .48)";
    context.lineWidth = 1;
    for (let x = state.referenceZoom; x < displayWidth; x += state.referenceZoom) {
      context.moveTo(x + .5, 0);
      context.lineTo(x + .5, displayHeight);
    }
    for (let y = state.referenceZoom; y < displayHeight; y += state.referenceZoom) {
      context.moveTo(0, y + .5);
      context.lineTo(displayWidth, y + .5);
    }
    context.stroke();
  }
  $("#referenceZoomRange").value = state.referenceZoom;
  $("#referenceZoomValue").value = `${state.referenceZoom}×`;
}

function updateReferenceZoom(value) {
  state.referenceZoom = Math.max(8, Math.min(28, Math.round(Number(value) / 2) * 2 || 16));
  renderLargeChallengeReference();
}

function fitReferenceZoom() {
  const wrap = $(".reference-canvas-wrap");
  const challenge = state.activeChallenge;
  if (!challenge) return;
  const availableWidth = Math.max(128, wrap.clientWidth - 52);
  const availableHeight = Math.max(128, wrap.clientHeight - 52);
  const fit = Math.floor(Math.min(availableWidth / challenge.width, availableHeight / challenge.height) / 2) * 2;
  updateReferenceZoom(fit);
}

function openChallengeReference() {
  const challenge = state.activeChallenge;
  if (!challenge) return;
  $("#referenceTitle").textContent = challenge.title;
  $("#referenceLevel").textContent = `${state.language === "ru" ? "Испытание" : "Challenge"} ${challenge.level} / ${CHALLENGES.length}`;
  $("#referenceDescription").textContent = challenge.description;
  const rules = $("#referenceRules");
  rules.innerHTML = "";
  challenge.rules.forEach((rule) => {
    const item = document.createElement("span");
    item.textContent = rule;
    rules.append(item);
  });
  const storyboard = $("#referenceStoryboard");
  const buttons = $("#referenceFrameButtons");
  storyboard.hidden = !challenge.frameTemplates;
  buttons.innerHTML = "";
  challenge.frameTemplates?.forEach((template, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = index === state.referenceFrame ? "active" : "";
    const canvas = document.createElement("canvas");
    drawChallengeTemplate(canvas, challenge, template);
    const label = document.createElement("span");
    label.textContent = `${state.language === "ru" ? "Кадр" : "Frame"} ${index + 1}`;
    button.append(canvas, label);
    button.addEventListener("click", () => {
      state.referenceFrame = index;
      renderLargeChallengeReference();
      buttons.querySelectorAll("button").forEach((item, buttonIndex) => item.classList.toggle("active", buttonIndex === index));
    });
    buttons.append(button);
  });
  $("#challengeReferenceDialog").showModal();
  requestAnimationFrame(fitReferenceZoom);
}

function startChallenge(challenge) {
  $("#challengesDialog").close();
  resetProject(challenge.width, challenge.height);
  state.activeChallenge = challenge;
  state.referenceFrame = 0;
  $("#projectName").value = challenge.title;
  state.color = challenge.id === "tiny-robot" ? "#5e9cff" : challenge.id === "pixel-heart" ? "#ed6473" : "#f7d154";
  $("#colorPicker").value = state.color;
  $("#colorHex").value = state.color.toUpperCase();
  render();
  showToast(state.language === "ru" ? "Испытание началось — образец всегда рядом" : "Challenge started — keep an eye on the reference");
}

function challengeFrames() {
  return state.layers[0].frames.map((_, index) => compositeFrame(index).data);
}

function showChallengeResult(result) {
  let resultBox = $("#challengeResult");
  if (!resultBox) {
    resultBox = document.createElement("div");
    resultBox.id = "challengeResult";
    resultBox.className = "challenge-result";
    resultBox.innerHTML = '<span class="challenge-result-icon"></span><strong></strong><p></p>';
    document.body.append(resultBox);
  }
  const failed = result.checks.filter((check) => !check.passed).map((check) => check.id);
  const labels = {
    similarity: state.language === "ru" ? "сходство с образцом" : "template similarity",
    colors: state.language === "ru" ? "количество цветов" : "color count",
    frames: state.language === "ru" ? "количество кадров" : "frame count",
    motion: state.language === "ru" ? "движение между кадрами" : "movement between frames",
    sequence: state.language === "ru" ? "порядок и вид кадров" : "frame order and appearance"
  };
  resultBox.classList.toggle("failed", !result.passed);
  resultBox.querySelector(".challenge-result-icon").textContent = result.passed ? "✓" : "↻";
  resultBox.querySelector("strong").textContent = result.passed
    ? (state.language === "ru" ? `Испытание пройдено · ${result.score}%` : `Challenge completed · ${result.score}%`)
    : (state.language === "ru" ? `Пока не готово · ${result.score}%` : `Not quite yet · ${result.score}%`);
  resultBox.querySelector("p").textContent = result.passed
    ? (state.language === "ru" ? "Отличная работа. Результат сохранён в твоём прогрессе." : "Great work. Your progress has been saved.")
    : `${state.language === "ru" ? "Нужно улучшить" : "Improve"}: ${failed.map((id) => labels[id]).join(", ")}.`;
  resultBox.classList.add("show");
  clearTimeout(showChallengeResult.timer);
  showChallengeResult.timer = setTimeout(() => resultBox.classList.remove("show"), 5000);
}

function playVictoryChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audio = new AudioContext();
    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = "square";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(.035, audio.currentTime + index * .09);
      gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + index * .09 + .16);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(audio.currentTime + index * .09);
      oscillator.stop(audio.currentTime + index * .09 + .17);
    });
    setTimeout(() => audio.close(), 700);
  } catch {
    // Audio is a bonus; visual feedback remains available.
  }
}

function createPixelConfetti() {
  const host = $("#pixelConfetti");
  const colors = ["#f1c542", "#ed6473", "#5ccda4", "#5e9cff", "#af70e2", "#ffffff"];
  host.innerHTML = "";
  for (let index = 0; index < 52; index += 1) {
    const pixel = document.createElement("i");
    pixel.style.left = `${Math.random() * 100}%`;
    pixel.style.setProperty("--confetti-color", colors[index % colors.length]);
    pixel.style.setProperty("--fall-time", `${1.8 + Math.random() * 1.8}s`);
    pixel.style.setProperty("--fall-delay", `${Math.random() * .7}s`);
    pixel.style.setProperty("--drift", `${-80 + Math.random() * 160}px`);
    host.append(pixel);
  }
}

function showVictory(result, award) {
  const challenge = state.activeChallenge;
  const progress = award.progress;
  const nextIndex = CHALLENGES.findIndex((item) => item.id === challenge.id) + 1;
  const nextChallenge = CHALLENGES[nextIndex];
  $("#victoryTitle").textContent = challenge.title;
  $("#victoryScore").textContent = `${result.score}%`;
  $("#victoryXp").textContent = award.earnedXp ? `+${award.earnedXp} XP` : (state.language === "ru" ? "XP уже получен" : "XP already earned");
  $("#victoryStreak").textContent = `⚡ ${progress.streak}`;
  $("#victoryMessage").textContent = award.firstCompletion
    ? (state.language === "ru" ? "Новый результат сохранён. Продолжай серию!" : "New result saved. Keep the streak going!")
    : (state.language === "ru" ? "Лучший результат обновлён, награда за это задание уже была получена." : "Best score updated; this mission's XP was already collected.");
  $("#victoryNext").hidden = !nextChallenge;
  $("#victoryNext").dataset.challengeId = nextChallenge?.id || "";
  createPixelConfetti();
  $("#challengeVictory").hidden = false;
  $("#challengeRunner").classList.remove("challenge-success");
  requestAnimationFrame(() => $("#challengeRunner").classList.add("challenge-success"));
  playVictoryChime();
}

function closeVictory() {
  $("#challengeVictory").hidden = true;
  $("#pixelConfetti").innerHTML = "";
}

function checkActiveChallenge() {
  if (!state.activeChallenge) return;
  const result = verifyChallenge(state.activeChallenge, challengeFrames());
  if (result.passed) {
    const award = awardChallenge(challengeProgress(), state.activeChallenge, result.score);
    saveChallengeProgress(award.progress);
    renderChallengeList();
    showVictory(result, award);
    return;
  }
  showChallengeResult(result);
}

function leaveChallenge() {
  state.activeChallenge = null;
  renderChallengeRunner();
  showToast(state.language === "ru" ? "Режим испытания закрыт, рисунок сохранён" : "Challenge mode closed, your drawing is safe");
}

function frameFromSource(source, sourceWidth, sourceHeight, width, height) {
  const surface = document.createElement("canvas");
  surface.width = width;
  surface.height = height;
  const surfaceCtx = surface.getContext("2d");
  surfaceCtx.imageSmoothingEnabled = false;
  surfaceCtx.drawImage(source, 0, 0, sourceWidth, sourceHeight, 0, 0, width, height);
  return surfaceCtx.getImageData(0, 0, width, height);
}

async function importImage(file) {
  state.activeChallenge = null;
  const bytes = await file.arrayBuffer();
  let frames = [];
  let sourceWidth;
  let sourceHeight;

  if (file.type === "image/gif" && "ImageDecoder" in window) {
    const decoder = new ImageDecoder({ data: bytes, type: file.type });
    await decoder.tracks.ready;
    const count = decoder.tracks.selectedTrack.frameCount;
    for (let index = 0; index < count; index += 1) {
      const { image } = await decoder.decode({ frameIndex: index, completeFramesOnly: true });
      sourceWidth ||= image.displayWidth;
      sourceHeight ||= image.displayHeight;
      frames.push(image);
    }
  } else {
    const bitmap = await createImageBitmap(new Blob([bytes], { type: file.type }));
    sourceWidth = bitmap.width;
    sourceHeight = bitmap.height;
    frames = [bitmap];
  }

  const scale = Math.min(1, 128 / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  state.width = width;
  state.height = height;
  const importedFrames = frames.map((frame) => frameFromSource(frame, sourceWidth, sourceHeight, width, height));
  frames.forEach((frame) => frame.close?.());
  state.layers = [{ name: `${t("layer")} 1`, visible: true, frames: importedFrames }];
  state.activeLayer = 0;
  state.activeFrame = 0;
  state.editorBuffer = null;
  state.projectId = crypto.randomUUID();
  canvas.width = width;
  canvas.height = height;
  previewCanvas.width = width;
  previewCanvas.height = height;
  $("#projectName").value = file.name.replace(/\.[^.]+$/, "");
  fitZoom();
  render();
  showToast(t("imported"));
}

function fitZoom() {
  const wrap = $("#canvasWrap");
  const availableWidth = Math.max(160, wrap.clientWidth - 24);
  const availableHeight = Math.max(160, wrap.clientHeight - 24);
  state.zoom = Math.max(2, Math.min(40, Math.floor(Math.min(availableWidth / state.width, availableHeight / state.height))));
  resizeCanvas();
}

function showsBrushPreview() {
  return Boolean(state.hoverPoint && ["pencil", "eraser"].includes(state.tool));
}

function renderBrushCursor() {
  if (!showsBrushPreview()) {
    brushCursor.style.display = "none";
    return;
  }
  const width = Math.min(state.brushSize, state.width - state.hoverPoint.x) * state.zoom;
  const height = Math.min(state.brushSize, state.height - state.hoverPoint.y) * state.zoom;
  brushCursor.style.display = "block";
  brushCursor.style.width = `${width}px`;
  brushCursor.style.height = `${height}px`;
  brushCursor.style.transform = `translate3d(${state.hoverPoint.x * state.zoom}px, ${state.hoverPoint.y * state.zoom}px, 0)`;
}

function scheduleBrushCursor() {
  if (state.cursorFrame) return;
  state.cursorFrame = requestAnimationFrame(() => {
    state.cursorFrame = 0;
    renderBrushCursor();
  });
}

function renderGrid() {
  const displayWidth = state.width * state.zoom;
  const displayHeight = state.height * state.zoom;
  const ratio = window.devicePixelRatio || 1;
  gridCanvas.width = Math.round(displayWidth * ratio);
  gridCanvas.height = Math.round(displayHeight * ratio);
  gridCanvas.style.width = `${displayWidth}px`;
  gridCanvas.style.height = `${displayHeight}px`;
  gridCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
  gridCtx.clearRect(0, 0, displayWidth, displayHeight);
  gridCanvas.hidden = !state.gridVisible;
  if (state.gridVisible) {
    gridCtx.beginPath();
    gridCtx.strokeStyle = state.zoom >= 8 ? "rgba(12, 11, 14, .42)" : "rgba(12, 11, 14, .28)";
    gridCtx.lineWidth = 1;
    for (let x = state.zoom; x < displayWidth; x += state.zoom) {
      gridCtx.moveTo(x + 0.5, 0);
      gridCtx.lineTo(x + 0.5, displayHeight);
    }
    for (let y = state.zoom; y < displayHeight; y += state.zoom) {
      gridCtx.moveTo(0, y + 0.5);
      gridCtx.lineTo(displayWidth, y + 0.5);
    }
    gridCtx.stroke();
  }

}

function renderInteraction() {
  const displayWidth = state.width * state.zoom;
  const displayHeight = state.height * state.zoom;
  const ratio = window.devicePixelRatio || 1;
  if (interactionCanvas.width !== Math.round(displayWidth * ratio) || interactionCanvas.height !== Math.round(displayHeight * ratio)) {
    interactionCanvas.width = Math.round(displayWidth * ratio);
    interactionCanvas.height = Math.round(displayHeight * ratio);
    interactionCanvas.style.width = `${displayWidth}px`;
    interactionCanvas.style.height = `${displayHeight}px`;
  }
  interactionCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
  interactionCtx.clearRect(0, 0, displayWidth, displayHeight);
  interactionCanvas.hidden = !state.selection;

  if (state.selection) {
    const selection = state.pendingSelection || state.selection;
    interactionCtx.save();
    interactionCtx.strokeStyle = "#ffffff";
    interactionCtx.lineWidth = 2;
    interactionCtx.setLineDash([5, 4]);
    interactionCtx.shadowColor = "rgba(0, 0, 0, .9)";
    interactionCtx.shadowBlur = 2;
    interactionCtx.strokeRect(
      selection.x * state.zoom + 1,
      selection.y * state.zoom + 1,
      selection.width * state.zoom - 2,
      selection.height * state.zoom - 2
    );
    interactionCtx.restore();
  }

}

function resizeCanvas() {
  canvas.style.width = `${state.width * state.zoom}px`;
  canvas.style.height = `${state.height * state.zoom}px`;
  const gridSize = `${state.zoom}px ${state.zoom}px`;
  canvas.style.backgroundSize = gridSize;
  canvas.style.backgroundPosition = `0 0, 0 ${state.zoom / 2}px, ${state.zoom / 2}px -${state.zoom / 2}px, -${state.zoom / 2}px 0`;
  $("#zoomValue").value = `${state.zoom}×`;
  renderGrid();
  renderInteraction();
  scheduleBrushCursor();
  requestAnimationFrame(updateCanvasRect);
}

PALETTE.forEach((color) => {
  const button = document.createElement("button");
  button.className = "swatch";
  button.style.background = color;
  button.title = color;
  button.addEventListener("click", () => {
    state.color = color;
    $("#colorPicker").value = color;
    $("#colorHex").value = color.toUpperCase();
  });
  $("#swatches").append(button);
});

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  updateCanvasRect();
  canvas.setPointerCapture(event.pointerId);
  startPaint(event);
});
canvas.addEventListener("pointermove", continuePaint);
canvas.addEventListener("pointermove", (event) => {
  state.hoverPoint = pointFromEvent(event);
  if (state.drawing) return;
  if (!state.drawing && state.tool === "select") {
    canvas.style.cursor = pointInSelection(state.hoverPoint) ? "move" : "cell";
  }
  scheduleBrushCursor();
});
canvas.addEventListener("pointerenter", (event) => {
  updateCanvasRect();
  state.hoverPoint = pointFromEvent(event);
  scheduleBrushCursor();
});
canvas.addEventListener("pointerleave", () => {
  state.hoverPoint = null;
  scheduleBrushCursor();
});
$("#canvasWrap").addEventListener("scroll", updateCanvasRect, { passive: true });
window.addEventListener("resize", updateCanvasRect, { passive: true });
canvas.addEventListener("pointerup", endPaint);
canvas.addEventListener("pointercancel", endPaint);
canvas.addEventListener("contextmenu", (event) => event.preventDefault());

$("#toolGrid").addEventListener("click", (event) => {
  const button = event.target.closest("[data-tool]");
  if (button) setTool(button.dataset.tool);
});
$("#colorPicker").addEventListener("input", (event) => {
  state.color = event.target.value;
  $("#colorHex").value = state.color.toUpperCase();
});
$("#brushSizes").addEventListener("click", (event) => {
  const button = event.target.closest("[data-size]");
  if (!button) return;
  state.brushSize = Number(button.dataset.size);
  document.querySelectorAll("#brushSizes button").forEach((item) => item.classList.toggle("active", item === button));
  $("#brushValue").value = `${state.brushSize} px`;
  scheduleBrushCursor();
});
$("#fpsRange").addEventListener("input", (event) => {
  state.fps = Number(event.target.value);
  $("#fpsValue").value = `${state.fps} FPS`;
  updateStats();
});
$("#onionSkin").addEventListener("change", (event) => {
  state.onionSkin = event.target.checked;
  renderEditor();
});
$("#addFrame").addEventListener("click", () => addFrame(false));
$("#duplicateFrame").addEventListener("click", () => addFrame(true));
$("#copyFrame").addEventListener("click", copyWholeFrame);
$("#pasteFrame").addEventListener("click", pasteWholeFrame);
$("#deleteFrame").addEventListener("click", deleteFrame);
$("#clearFrame").addEventListener("click", clearFrame);
$("#undoButton").addEventListener("click", undo);
const exportDialog = $("#exportDialog");
function exportScale() {
  return Math.max(1, Math.min(16, Math.round(Number($("#exportScale").value) || 1)));
}
function updateExportScale(value = $("#exportScale").value, commit = true) {
  const scale = Math.max(1, Math.min(16, Math.round(Number(value) || 1)));
  if (commit) $("#exportScale").value = scale;
  $("#exportOutputSize").value = `${state.width} × ${state.height} → ${state.width * scale} × ${state.height * scale} px`;
  document.querySelectorAll("[data-export-scale]").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.exportScale) === scale);
  });
}
$("#exportGif").addEventListener("click", () => { exportGif(); exportDialog.close(); });
$("#exportPng").addEventListener("click", () => { exportPng(); exportDialog.close(); });
$("#exportSheet").addEventListener("click", () => { exportSpriteSheet(); exportDialog.close(); });
$("#exportProject").addEventListener("click", () => { exportProjectFile(); exportDialog.close(); });
$("#exportMenuButton").addEventListener("click", () => {
  updateExportScale();
  exportDialog.showModal();
});
$("#closeExport").addEventListener("click", () => exportDialog.close());
$("#exportScale").addEventListener("input", (event) => {
  if (event.target.value !== "") updateExportScale(event.target.value, false);
});
$("#exportScale").addEventListener("change", (event) => updateExportScale(event.target.value));
$("#exportScalePresets").addEventListener("click", (event) => {
  const button = event.target.closest("[data-export-scale]");
  if (button) updateExportScale(button.dataset.exportScale);
});
$("#importFile").addEventListener("click", () => {
  $("#projectMenu").open = false;
  $("#fileInput").click();
});
$("#fileInput").addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  try {
    if (file.name.toLowerCase().endsWith(".pixelmotion") || file.type === "application/json") await importProjectFile(file);
    else await importImage(file);
  }
  catch (error) {
    console.error(error);
    showToast(file.name.toLowerCase().endsWith(".pixelmotion") ? `${t("invalidProject")}: ${error.message}` : "Не удалось импортировать файл");
  }
  event.target.value = "";
});
$("#languageSelect").addEventListener("change", (event) => applyLanguage(event.target.value));
$("#projectName").addEventListener("input", scheduleAutosave);
$("#addLayer").addEventListener("click", addLayer);
$("#copySelection").addEventListener("click", copySelection);
$("#pasteSelection").addEventListener("click", pasteSelection);
$("#rotateSelection").addEventListener("click", () => transformSelection("rotate"));
$("#flipSelectionX").addEventListener("click", () => transformSelection("flipX"));
$("#flipSelectionY").addEventListener("click", () => transformSelection("flipY"));
$("#zoomIn").addEventListener("click", () => { state.autoFit = false; state.zoom = Math.min(32, state.zoom + 2); resizeCanvas(); });
$("#zoomOut").addEventListener("click", () => { state.autoFit = false; state.zoom = Math.max(2, state.zoom - 2); resizeCanvas(); });
$("#zoomFit").addEventListener("click", () => {
  state.autoFit = true;
  fitZoom();
});
$("#toggleGrid").addEventListener("click", (event) => {
  state.gridVisible = !state.gridVisible;
  event.currentTarget.classList.toggle("active");
  renderGrid();
});
$("#playPause").addEventListener("click", (event) => {
  state.playing = !state.playing;
  event.currentTarget.textContent = state.playing ? "Ⅱ" : "▶";
});

const dialog = $("#newProjectDialog");
$("#newProject").addEventListener("click", () => {
  $("#projectMenu").open = false;
  $("#projectWidth").value = state.width;
  $("#projectHeight").value = state.height;
  dialog.showModal();
});
$("#sizePresets").addEventListener("click", (event) => {
  const button = event.target.closest("[data-size]");
  if (!button) return;
  document.querySelectorAll("[data-size]").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  $("#projectWidth").value = button.dataset.size;
  $("#projectHeight").value = button.dataset.size;
});
$("#newProjectForm").addEventListener("submit", (event) => {
  const submitter = event.submitter;
  if (submitter?.value === "cancel") return;
  event.preventDefault();
  const width = Math.max(8, Math.min(128, Number($("#projectWidth").value) || 32));
  const height = Math.max(8, Math.min(128, Number($("#projectHeight").value) || 32));
  resetProject(width, height);
  $("#projectName").value = t("untitledProject");
  dialog.close();
  showToast(`Создан холст ${width} × ${height}`);
});

const projectsDialog = $("#projectsDialog");
document.querySelector(".brand").addEventListener("click", (event) => {
  event.preventDefault();
  renderRecentProjects();
  projectsDialog.showModal();
});
$("#closeProjects").addEventListener("click", () => projectsDialog.close());
$("#startNewProject").addEventListener("click", () => {
  projectsDialog.close();
  dialog.showModal();
});

const challengesDialog = $("#challengesDialog");
$("#openChallenges").addEventListener("click", () => {
  renderChallengeList();
  challengesDialog.showModal();
});
$("#closeChallenges").addEventListener("click", () => challengesDialog.close());
$("#checkChallenge").addEventListener("click", checkActiveChallenge);
$("#leaveChallenge").addEventListener("click", leaveChallenge);
$("#openChallengeReference").addEventListener("click", openChallengeReference);
$("#closeChallengeReference").addEventListener("click", () => $("#challengeReferenceDialog").close());
$("#referenceZoomRange").addEventListener("input", (event) => updateReferenceZoom(event.target.value));
$("#referenceZoomOut").addEventListener("click", () => updateReferenceZoom(state.referenceZoom - 2));
$("#referenceZoomIn").addEventListener("click", () => updateReferenceZoom(state.referenceZoom + 2));
$("#referenceZoomFit").addEventListener("click", fitReferenceZoom);
$("#referenceGridVisible").addEventListener("change", renderLargeChallengeReference);
$("#victoryClose").addEventListener("click", closeVictory);
$("#challengeVictory").addEventListener("click", (event) => {
  if (event.target === event.currentTarget) closeVictory();
});
$("#victoryNext").addEventListener("click", () => {
  const next = CHALLENGES.find((challenge) => challenge.id === $("#victoryNext").dataset.challengeId);
  closeVictory();
  if (next) startChallenge(next);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !$("#challengeVictory").hidden) {
    closeVictory();
    return;
  }
  if (event.target.matches("input")) return;
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "c") {
    event.preventDefault();
    copyWholeFrame();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "v") {
    event.preventDefault();
    pasteWholeFrame();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    undo();
    return;
  }
  const tools = { p: "pencil", e: "eraser", f: "fill", i: "picker", l: "line", r: "rectangle", o: "ellipse", s: "select" };
  if (tools[event.key.toLowerCase()]) setTool(tools[event.key.toLowerCase()]);
  if (event.key === "Delete") clearSelection();
  if (event.key === "Escape") {
    state.selection = null;
    renderEditor();
  }
});

let lastPreview = 0;
function animate(timestamp) {
  let shouldRender = state.previewDirty;
  if (state.playing && timestamp - lastPreview >= 1000 / state.fps) {
    state.previewFrame = (state.previewFrame + 1) % state.layers[0].frames.length;
    lastPreview = timestamp;
    shouldRender = true;
  }
  if (shouldRender) {
    previewCtx.clearRect(0, 0, state.width, state.height);
    previewCtx.putImageData(compositeFrame(state.previewFrame % state.layers[0].frames.length), 0, 0);
    state.previewDirty = false;
  }
  requestAnimationFrame(animate);
}

const detectedLanguage = navigator.language.slice(0, 2).toLowerCase();
state.language = localStorage.getItem("pixel-motion-language") || (TRANSLATIONS[detectedLanguage] ? detectedLanguage : "ru");
resetProject(32, 32);
applyLanguage(state.language);
$("#projectName").value = t("untitledProject");
setTool("pencil");
const canvasResizeObserver = new ResizeObserver(() => {
  if (state.autoFit) fitZoom();
});
canvasResizeObserver.observe($("#canvasWrap"));
requestAnimationFrame(animate);
