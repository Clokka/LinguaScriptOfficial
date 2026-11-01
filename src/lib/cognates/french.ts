/**
 * English → French "word rules": English and French share thousands of Latin
 * words, and a handful of ending rules turn one into the other
 * (nation → nation, liberty → liberté, rapidly → rapidement…).
 *
 * Word lists are hand-picked: common, easy words first in each rule, and
 * false friends left out (actually ≠ actuellement, library ≠ librairie,
 * sensible ≠ sensible…). Format of one entry:
 *   "nation"              same spelling in both languages
 *   "liberty>liberté"     English > French
 *   "error>erreur*f"      *f / *m overrides the rule's gender; *a = adjective, *n = noun
 * Checked by scripts/check-cognates.ts (every English word ends in the rule's
 * English ending, every French word in its French ending, no duplicates).
 */

export type Pos = "noun" | "adj" | "adv" | "verb" | "person";
export type Gender = "f" | "m";

export interface CognateRule {
  id: string;
  /** English ending(s), e.g. ["-ty"]. */
  en: string[];
  /** French ending(s), e.g. ["-té"]. */
  fr: string[];
  title: string;
  /** One-line tip shown on the rule card. */
  tip: string;
  pos: Pos;
  gender?: Gender;
  words: string;
}

export interface Cognate {
  en: string;
  fr: string;
  pos: Pos;
  gender?: Gender;
  rule: string;
}

export const FRENCH_RULES: CognateRule[] = [
  {
    id: "tion", en: ["-tion"], fr: ["-tion"], pos: "noun", gender: "f",
    title: "-tion stays -tion",
    tip: "Same spelling, French sound: na-SYON. They're all feminine: une nation. A new “e” at the start of a syllable often gets an accent: creation → création.",
    words: "nation, information, situation, question, attention, action, condition, position, tradition, solution, education>éducation, generation>génération, conversation, communication, organization>organisation, population, production, protection, relation, section, station, direction, creation>création, emotion>émotion, election>élection, operation>opération, reaction>réaction, revolution>révolution, imagination, invitation, option, motivation, introduction, collection, competition>compétition, construction, destination, fiction, inspiration, intention, invention, mention, notion, observation, preparation>préparation, presentation>présentation, publication, reservation>réservation, satisfaction, selection>sélection, sensation, separation>séparation, suggestion, ambition, addition, adoption, administration, animation, application, association, attraction, aviation, celebration>célébration, circulation, civilization>civilisation, combination, composition, concentration, conservation, constitution, consultation, contribution, cooperation>coopération, correction, decoration>décoration, declaration>déclaration, definition>définition, demonstration>démonstration, description, distribution, donation, edition>édition, evolution>évolution, exception, exclamation, execution>exécution, expedition>expédition, exploration, formation, fraction, gravitation, hesitation>hésitation, identification, illustration, imitation, immigration, indication, infection, inflation, injection, inscription, inspection, installation, institution, instruction, interaction, interpretation>interprétation, interruption, intervention, intuition, irrigation, lotion, migration, moderation>modération, multiplication, mutation, narration, navigation, negotiation>négociation, nutrition, objection, obligation, occupation, orientation, participation, perception, perfection, petition>pétition, pollution, portion, precaution>précaution, prescription, preservation>préservation, prevention>prévention, projection, promotion, proportion, ration, reception>réception, reduction>réduction, renovation>rénovation, repetition>répétition, reputation>réputation, resolution>résolution, respiration, restriction, rotation, salutation, sanction, speculation>spéculation, stimulation, substitution, superstition, transaction, transformation, transition, variation, ventilation, vibration, vocation",
  },
  {
    id: "sion", en: ["-sion"], fr: ["-sion"], pos: "noun", gender: "f",
    title: "-sion stays -sion",
    tip: "Same spelling, feminine: une décision. Say it zee-ON or see-ON.",
    words: "decision>décision, television>télévision, version, vision, mission, passion, discussion, expression, impression, profession, session, tension, conclusion, confusion, dimension, division, explosion, extension, illusion, invasion, permission, precision>précision, revision>révision, admission, aggression>agression, collision, commission, compassion, comprehension>compréhension, compression, concession, confession, conversion, depression>dépression, emission>émission, erosion>érosion, evasion>évasion, excursion, exclusion, expansion, fusion, inclusion, intrusion, obsession, pension, persuasion, possession, progression, provision, succession, suspension, transmission, allusion",
  },
  {
    id: "able", en: ["-able", "-ible"], fr: ["-able", "-ible"], pos: "adj",
    title: "-able / -ible stay the same",
    tip: "Describing words that end in -able or -ible are spelled the same: c'est possible, c'est terrible.",
    words: "possible, impossible, terrible, horrible, capable, probable, visible, invisible, flexible, stable, adorable, admirable, acceptable, comparable, considerable, durable, notable, respectable, accessible, compatible, credible>crédible, adaptable, applicable, convertible, inevitable>inévitable, irresistible>irrésistible, tolerable>tolérable, vulnerable>vulnérable, divisible, eligible>éligible, imperceptible, incompatible, incorrigible, indestructible, indivisible, inexplicable, infallible>infaillible, inflexible, invincible, irritable, memorable>mémorable, negotiable>négociable, plausible, preferable>préférable, presentable>présentable, profitable, recyclable, reversible>réversible, sociable, tangible, variable, venerable>vénérable, abominable, curable, desirable>désirable, detestable>détestable, excusable, honorable, impeccable, unimaginable>inimaginable, interminable, justifiable, lamentable, malleable>malléable, navigable, palpable, permeable>perméable, quantifiable, respirable, transferable>transférable, transportable, inseparable>inséparable, comprehensible>compréhensible",
  },
  {
    id: "ence", en: ["-ence", "-ance"], fr: ["-ence", "-ance"], pos: "noun", gender: "f",
    title: "-ence / -ance stay the same",
    tip: "Same spelling, feminine: une différence, la patience.",
    words: "difference>différence, science, experience>expérience, importance, distance, patience, silence, violence, intelligence, existence, influence, presence>présence, absence, conference>conférence, consequence>conséquence, preference>préférence, reference>référence, residence>résidence, resistance>résistance, finance, performance, ignorance, tolerance>tolérance, competence>compétence, conscience, elegance>élégance, endurance, essence, indifference>indifférence, innocence, impatience, interference>interférence, nuance, permanence, prudence, substance, turbulence, vigilance, alliance, ambulance, ambiance, arrogance, assistance, cadence, coherence>cohérence, coincidence>coïncidence, convergence, decadence>décadence, divergence, eloquence>éloquence, emergence>émergence, equivalence>équivalence, excellence, extravagance, incidence, insolence, magnificence, negligence>négligence, nonchalance, opulence, pertinence, prevalence>prévalence, providence, provenance, reticence>réticence, sequence>séquence, surveillance, vengeance, virulence, abstinence, adolescence, ambivalence, convalescence, diligence, fluorescence, imminence, impertinence, incandescence, inference>inférence, omniscience, reminiscence>réminiscence, resonance>résonance, reverence>révérence",
  },
  {
    id: "al", en: ["-al"], fr: ["-al"], pos: "adj",
    title: "-al stays -al",
    tip: "Most describing words in -al are the same: normal, final, national. (Words in -ial / -ual / -nal from -tion are different — that's a later rule.)",
    words: "normal, final, general>général, local, national, international, original, central, total, principal, global, ideal>idéal, legal>légal, mental, moral, social, special>spécial, vital, capital, brutal, medical>médical, musical, natural>naturel*skip, oral, royal, loyal, tropical, vertical, horizontal, illegal>illégal, initial, liberal>libéral, colonial, commercial, cordial, electoral>électoral, fatal, federal>fédéral, fiscal, frontal, imperial>impérial, literal>littéral, marginal, medieval>médiéval, municipal, naval, nominal, optimal, oriental, pastoral, phenomenal>phénoménal, radical, regional>régional, rural, sentimental, spatial, theatrical>théâtral, tonal, triumphal>triomphal, banal, colossal, crucial, filial, glacial, jovial, monumental, nasal, ornamental>ornemental, paranormal, postal, provincial, terminal, territorial, tribal, viral, vocal",
  },
  {
    id: "ant", en: ["-ant", "-ent"], fr: ["-ant", "-ent"], pos: "adj",
    title: "-ant / -ent stay the same",
    tip: "Same spelling: c'est important, il est intelligent. Add -e for a girl or a feminine word: elle est intelligente.",
    words: "important, intelligent, different>différent, excellent, elegant>élégant, evident>évident, innocent, patient, permanent, present>présent, recent>récent, absent, apparent, arrogant, brilliant>brillant, competent>compétent, constant, decent>décent, dominant, eminent>éminent, equivalent>équivalent, frequent>fréquent, flagrant, ignorant, imminent, impatient, impertinent, indifferent>indifférent, inherent>inhérent, insolent, intolerant>intolérant, latent, militant, negligent>négligent, omnipresent>omniprésent, opulent, pertinent, prudent, reticent>réticent, tolerant>tolérant, transparent, urgent, vacant, vibrant, vigilant, violent, ambivalent, coherent>cohérent, diligent, distant, divergent, eloquent>éloquent, emergent>émergent, extravagant, fluorescent, fervent, flamboyant, incompetent>incompétent, indulgent, intermittent, nonchalant, omnipotent, pedant>pédant, recurrent>récurrent, resistant>résistant, strident, turbulent, vehement>véhément, virulent",
  },
  {
    id: "ure", en: ["-ure"], fr: ["-ure"], pos: "noun", gender: "f",
    title: "-ure stays -ure",
    tip: "Same spelling, feminine: la nature, une culture.",
    words: "nature, culture, temperature>température, structure, signature, architecture, agriculture, literature>littérature, creature>créature, sculpture, texture, procedure>procédure, posture, capture, fracture, miniature, rupture, torture, caricature, conjecture, infrastructure, armature, fissure, nomenclature, stature, suture, verdure, acupuncture",
  },
  {
    id: "ment", en: ["-ment"], fr: ["-ment"], pos: "noun", gender: "m",
    title: "-ment (things) stays -ment",
    tip: "Nouns ending in -ment are masculine: un moment, le gouvernement. Sometimes an extra letter sneaks in: development → développement.",
    words: "moment, document, monument, argument, instrument, element>élément, government>gouvernement, environment>environnement, development>développement, movement>mouvement, apartment>appartement, department>département, equipment>équipement, payment>paiement, treatment>traitement, segment, sentiment, supplement>supplément, compliment, parliament>parlement, engagement, fragment, placement, ornament>ornement, pigment, sediment>sédiment, temperament>tempérament, testament, torment>tourment, filament, firmament, ligament, amendment>amendement, arrangement, attachment>attachement, bombardment>bombardement, encouragement, judgment>jugement, recruitment>recrutement, sacrament>sacrement, armament>armement, alignment>alignement, adjustment>ajustement, deployment>déploiement, resentment>ressentiment",
  },
  {
    id: "ist", en: ["-ist"], fr: ["-iste"], pos: "person",
    title: "-ist → -iste",
    tip: "Add an -e: artist → artiste. Same word for a boy or a girl: il est artiste, elle est artiste.",
    words: "artist>artiste, tourist>touriste, journalist>journaliste, dentist>dentiste, pianist>pianiste, guitarist>guitariste, cyclist>cycliste, optimist>optimiste, pessimist>pessimiste, realist>réaliste, idealist>idéaliste, specialist>spécialiste, activist>activiste, feminist>féministe, socialist>socialiste, capitalist>capitaliste, communist>communiste, economist>économiste, finalist>finaliste, florist>fleuriste, humorist>humoriste, linguist>linguiste, minimalist>minimaliste, nationalist>nationaliste, naturalist>naturaliste, perfectionist>perfectionniste, racist>raciste, receptionist>réceptionniste, terrorist>terroriste, violinist>violoniste, archivist>archiviste, botanist>botaniste, egoist>égoïste, extremist>extrémiste, futurist>futuriste, harpist>harpiste, individualist>individualiste, moralist>moraliste, organist>organiste, pacifist>pacifiste, populist>populiste, purist>puriste, separatist>séparatiste, stylist>styliste, surrealist>surréaliste, traditionalist>traditionaliste, biologist>biologiste, chemist>chimiste",
  },
  {
    id: "ism", en: ["-ism"], fr: ["-isme"], pos: "noun", gender: "m",
    title: "-ism → -isme",
    tip: "Add -e; they're masculine: le tourisme, l'optimisme.",
    words: "tourism>tourisme, journalism>journalisme, optimism>optimisme, pessimism>pessimisme, realism>réalisme, idealism>idéalisme, socialism>socialisme, capitalism>capitalisme, communism>communisme, feminism>féminisme, activism>activisme, racism>racisme, terrorism>terrorisme, nationalism>nationalisme, patriotism>patriotisme, heroism>héroïsme, humanism>humanisme, individualism>individualisme, materialism>matérialisme, mechanism>mécanisme, minimalism>minimalisme, modernism>modernisme, organism>organisme, perfectionism>perfectionnisme, populism>populisme, romanticism>romantisme, scepticism>scepticisme, surrealism>surréalisme, symbolism>symbolisme, egoism>égoïsme, extremism>extrémisme, fanaticism>fanatisme, impressionism>impressionnisme, liberalism>libéralisme, magnetism>magnétisme, alcoholism>alcoolisme, autism>autisme, cynicism>cynisme, dynamism>dynamisme, favouritism>favoritisme, fascism>fascisme, imperialism>impérialisme, mysticism>mysticisme, naturalism>naturalisme, paternalism>paternalisme, professionalism>professionnalisme, radicalism>radicalisme, tribalism>tribalisme, vandalism>vandalisme, catholicism>catholicisme",
  },
  {
    id: "ty", en: ["-ty"], fr: ["-té"], pos: "noun", gender: "f",
    title: "-ty → -té",
    tip: "Swap -ty for -té: liberty → liberté. They're feminine: la qualité, une possibilité.",
    words: "liberty>liberté, quality>qualité, reality>réalité, university>université, activity>activité, society>société, security>sécurité, possibility>possibilité, personality>personnalité, majority>majorité, minority>minorité, identity>identité, priority>priorité, quantity>quantité, difficulty>difficulté, curiosity>curiosité, creativity>créativité, electricity>électricité, humanity>humanité, nationality>nationalité, necessity>nécessité, popularity>popularité, probability>probabilité, responsibility>responsabilité, simplicity>simplicité, speciality>spécialité, stability>stabilité, unity>unité, utility>utilité, variety>variété, visibility>visibilité, beauty>beauté, capacity>capacité, celebrity>célébrité, charity>charité, diversity>diversité, eternity>éternité, faculty>faculté, fraternity>fraternité, gravity>gravité, immunity>immunité, intensity>intensité, mobility>mobilité, morality>moralité, sincerity>sincérité, dignity>dignité, entity>entité, flexibility>flexibilité, fidelity>fidélité, hostility>hostilité, hospitality>hospitalité, integrity>intégrité, mentality>mentalité, modernity>modernité, obscurity>obscurité, opportunity>opportunité, originality>originalité, prosperity>prospérité, rapidity>rapidité, regularity>régularité, sensibility>sensibilité, timidity>timidité, tranquillity>tranquillité, validity>validité, vanity>vanité, velocity>vélocité, loyalty>loyauté, sobriety>sobriété, anxiety>anxiété, complexity>complexité, density>densité, credibility>crédibilité, formality>formalité, legality>légalité, locality>localité, neutrality>neutralité, normality>normalité, totality>totalité, brutality>brutalité, municipality>municipalité, punctuality>ponctualité, generosity>générosité, luminosity>luminosité, animosity>animosité, virtuosity>virtuosité, severity>sévérité, solidarity>solidarité",
  },
  {
    id: "y", en: ["-y"], fr: ["-ie"], pos: "noun", gender: "f",
    title: "-y → -ie (subjects & ideas)",
    tip: "Swap -y for -ie: biology → biologie. Feminine: la géographie. “ph” and “th” stay.",
    words: "biology>biologie, energy>énergie, geography>géographie, philosophy>philosophie, psychology>psychologie, photography>photographie, technology>technologie, theory>théorie, economy>économie, astronomy>astronomie, anatomy>anatomie, biography>biographie, category>catégorie, colony>colonie, comedy>comédie, company>compagnie, democracy>démocratie, gallery>galerie, harmony>harmonie, ideology>idéologie, industry>industrie, irony>ironie, jealousy>jalousie, melody>mélodie, monarchy>monarchie, mythology>mythologie, pharmacy>pharmacie, symphony>symphonie, strategy>stratégie, theology>théologie, tragedy>tragédie, zoology>zoologie, allergy>allergie, anarchy>anarchie, anomaly>anomalie, apathy>apathie, archaeology>archéologie, astrology>astrologie, autopsy>autopsie, battery>batterie, bureaucracy>bureaucratie, ceremony>cérémonie, chronology>chronologie, ecology>écologie, euphoria>euphorie*skip, fantasy>fantaisie, geology>géologie, geometry>géométrie, hierarchy>hiérarchie, hypocrisy>hypocrisie, infantry>infanterie, lottery>loterie, methodology>méthodologie, nostalgia>nostalgie*skip, pathology>pathologie, pedagogy>pédagogie, phobia>phobie*skip, physiology>physiologie, rhapsody>rhapsodie, sociology>sociologie, terminology>terminologie, therapy>thérapie, topography>topographie, tyranny>tyrannie, utopia>utopie*skip, analogy>analogie, autonomy>autonomie, cartography>cartographie, choreography>chorégraphie, cosmology>cosmologie, demography>démographie, dynasty>dynastie, empathy>empathie, liturgy>liturgie, monotony>monotonie, symmetry>symétrie, telepathy>télépathie",
  },
  {
    id: "ic", en: ["-ic", "-ical"], fr: ["-ique"], pos: "adj",
    title: "-ic / -ical → -ique",
    tip: "Both -ic and -ical become -ique: magic(al) → magique, logical → logique.",
    words: "fantastic>fantastique, magic>magique, logical>logique, classic>classique, electric>électrique, economic>économique, historic>historique, political>politique, practical>pratique, typical>typique, physical>physique, dramatic>dramatique, automatic>automatique, romantic>romantique, artistic>artistique, scientific>scientifique, specific>spécifique, technical>technique, tragic>tragique, comic>comique, critical>critique, dynamic>dynamique, electronic>électronique, ethical>éthique, exotic>exotique, graphic>graphique, ironic>ironique, mechanical>mécanique, mystic>mystique, organic>organique, pacific>pacifique, plastic>plastique, poetic>poétique, psychological>psychologique, rhythmic>rythmique, sarcastic>sarcastique, strategic>stratégique, symbolic>symbolique, systematic>systématique, theoretical>théorique, academic>académique, allergic>allergique, athletic>athlétique, atomic>atomique, authentic>authentique, basic>basique, biological>biologique, chronic>chronique, cyclic>cyclique, democratic>démocratique, diplomatic>diplomatique, energetic>énergique, epic>épique, geographic>géographique, geometric>géométrique, harmonic>harmonique, heroic>héroïque, hysterical>hystérique, ideological>idéologique, identical>identique, magnetic>magnétique, mathematical>mathématique, metallic>métallique, methodical>méthodique, pathetic>pathétique, patriotic>patriotique, philosophical>philosophique, sceptical>sceptique, symmetric>symétrique, volcanic>volcanique, alphabetical>alphabétique, analytic>analytique, angelic>angélique, archaeological>archéologique, aromatic>aromatique, astronomic>astronomique, biographic>biographique, chaotic>chaotique, charismatic>charismatique, cosmic>cosmique, despotic>despotique, domestic>domestique, drastic>drastique, ecological>écologique, elastic>élastique, emblematic>emblématique, enigmatic>énigmatique, aesthetic>esthétique, fanatic>fanatique, frenetic>frénétique, genetic>génétique, gothic>gothique, hypothetical>hypothétique, idyllic>idyllique, linguistic>linguistique, lyrical>lyrique, microscopic>microscopique, mythical>mythique, nostalgic>nostalgique, panoramic>panoramique, pedagogical>pédagogique, photographic>photographique, problematic>problématique, prophetic>prophétique, rhetorical>rhétorique, robotic>robotique, sociological>sociologique, statistical>statistique, tactical>tactique, telescopic>télescopique, therapeutic>thérapeutique, toxic>toxique, tyrannical>tyrannique",
  },
  {
    id: "ly", en: ["-ly"], fr: ["-ment"], pos: "adv",
    title: "-ly → -ment (how you do things)",
    tip: "English -ly is French -ment: rapidly → rapidement, exactly → exactement. Take the French describing word (girl form), add -ment.",
    words: "finally>finalement, rapidly>rapidement, exactly>exactement, normally>normalement, simply>simplement, certainly>certainement, completely>complètement, directly>directement, generally>généralement, immediately>immédiatement, naturally>naturellement, personally>personnellement, probably>probablement, totally>totalement, absolutely>absolument, clearly>clairement, correctly>correctement, perfectly>parfaitement, particularly>particulièrement, practically>pratiquement, really>réellement, seriously>sérieusement, sincerely>sincèrement, terribly>terriblement, rarely>rarement, regularly>régulièrement, relatively>relativement, secretly>secrètement, specially>spécialement, actively>activement, calmly>calmement, entirely>entièrement, extremely>extrêmement, frankly>franchement, honestly>honnêtement, incredibly>incroyablement, infinitely>infiniment, initially>initialement, legally>légalement, logically>logiquement, mentally>mentalement, officially>officiellement, physically>physiquement, politely>poliment, positively>positivement, precisely>précisément, principally>principalement, profoundly>profondément, romantically>romantiquement, silently>silencieusement, socially>socialement, specifically>spécifiquement, spontaneously>spontanément, strictly>strictement, surely>sûrement, traditionally>traditionnellement, typically>typiquement, uniquely>uniquement, universally>universellement, visually>visuellement, attentively>attentivement, automatically>automatiquement, curiously>curieusement, dangerously>dangereusement, definitively>définitivement, delicately>délicatement, desperately>désespérément, enormously>énormément, essentially>essentiellement, exclusively>exclusivement, fundamentally>fondamentalement, furiously>furieusement, generously>généreusement, historically>historiquement, ideally>idéalement, illegally>illégalement, instantly>instantanément, internationally>internationalement, ironically>ironiquement, magnificently>magnifiquement, mutually>mutuellement, nervously>nerveusement, objectively>objectivement, occasionally>occasionnellement, partially>partiellement, passionately>passionnément, politically>politiquement, potentially>potentiellement, professionally>professionnellement, publicly>publiquement, purely>purement, radically>radicalement, reasonably>raisonnablement, severely>sévèrement, stupidly>stupidement, subtly>subtilement, superbly>superbement, symbolically>symboliquement, systematically>systématiquement, technically>techniquement, temporarily>temporairement, tragically>tragiquement, virtually>virtuellement, vigorously>vigoureusement",
  },
  {
    id: "ous", en: ["-ous"], fr: ["-eux"], pos: "adj",
    title: "-ous → -eux",
    tip: "Swap -ous for -eux: famous → fameux. For a girl or feminine word it's -euse: elle est curieuse.",
    words: "curious>curieux, dangerous>dangereux, delicious>délicieux, famous>fameux, nervous>nerveux, serious>sérieux, mysterious>mystérieux, generous>généreux, courageous>courageux, furious>furieux, precious>précieux, religious>religieux, ambitious>ambitieux, anxious>anxieux, audacious>audacieux, disastrous>désastreux, envious>envieux, fabulous>fabuleux, glorious>glorieux, gracious>gracieux, harmonious>harmonieux, joyous>joyeux, laborious>laborieux, luminous>lumineux, marvellous>merveilleux, miraculous>miraculeux, monstrous>monstrueux, odious>odieux, prestigious>prestigieux, rigorous>rigoureux, scandalous>scandaleux, spacious>spacieux, studious>studieux, superstitious>superstitieux, tumultuous>tumultueux, virtuous>vertueux, vicious>vicieux, victorious>victorieux, vigorous>vigoureux, ingenious>ingénieux, infectious>infectieux, contagious>contagieux, conscientious>consciencieux, capricious>capricieux, advantageous>avantageux, copious>copieux, impetuous>impétueux, judicious>judicieux, litigious>litigieux, melodious>mélodieux, pompous>pompeux, prodigious>prodigieux, sumptuous>somptueux, tortuous>tortueux",
  },
  {
    id: "ive", en: ["-ive"], fr: ["-if"], pos: "adj",
    title: "-ive → -if",
    tip: "Swap -ive for -if: active → actif. For a girl or feminine word it's -ive again: elle est active.",
    words: "active>actif, positive>positif, negative>négatif, creative>créatif, attractive>attractif, objective>objectif, relative>relatif, passive>passif, native>natif, massive>massif, collective>collectif, competitive>compétitif, constructive>constructif, decisive>décisif, defensive>défensif, descriptive>descriptif, destructive>destructif, educative>éducatif, excessive>excessif, exclusive>exclusif, expressive>expressif, impulsive>impulsif, inclusive>inclusif, informative>informatif, intensive>intensif, intuitive>intuitif, inventive>inventif, offensive>offensif, possessive>possessif, primitive>primitif, productive>productif, progressive>progressif, representative>représentatif, respective>respectif, selective>sélectif, subjective>subjectif, successive>successif, explosive>explosif, aggressive>agressif, alternative>alternatif, attentive>attentif, administrative>administratif, affirmative>affirmatif, communicative>communicatif, comparative>comparatif, consecutive>consécutif, corrosive>corrosif, demonstrative>démonstratif, digestive>digestif, distinctive>distinctif, evasive>évasif, executive>exécutif, expansive>expansif, festive>festif, fugitive>fugitif, generative>génératif, imaginative>imaginatif, imperative>impératif, interactive>interactif, intrusive>intrusif, lucrative>lucratif, narrative>narratif, normative>normatif, obsessive>obsessif, persuasive>persuasif, preventive>préventif, punitive>punitif, qualitative>qualitatif, quantitative>quantitatif, reactive>réactif, repetitive>répétitif, repressive>répressif, restrictive>restrictif, subversive>subversif, superlative>superlatif",
  },
  {
    id: "ary", en: ["-ary"], fr: ["-aire"], pos: "adj",
    title: "-ary → -aire",
    tip: "Swap -ary for -aire: necessary → nécessaire. Things (*) are masculine: un dictionnaire.",
    words: "necessary>nécessaire, ordinary>ordinaire, extraordinary>extraordinaire, contrary>contraire, military>militaire, imaginary>imaginaire, primary>primaire, secondary>secondaire, solitary>solitaire, temporary>temporaire, elementary>élémentaire, legendary>légendaire, literary>littéraire, arbitrary>arbitraire, planetary>planétaire, preliminary>préliminaire, revolutionary>révolutionnaire, visionary>visionnaire, culinary>culinaire, monetary>monétaire, sedentary>sédentaire, complementary>complémentaire, budgetary>budgétaire, auxiliary>auxiliaire, binary>binaire, hereditary>héréditaire, humanitarian>humanitaire*skip, rudimentary>rudimentaire, sanguinary>sanguinaire, tertiary>tertiaire, dictionary>dictionnaire*n, anniversary>anniversaire*n, adversary>adversaire*n, documentary>documentaire*n, itinerary>itinéraire*n, salary>salaire*n, secretary>secrétaire*n, vocabulary>vocabulaire*n, glossary>glossaire*n, sanctuary>sanctuaire*n, veterinary>vétérinaire*n, emissary>émissaire*n, commentary>commentaire*n, beneficiary>bénéficiaire*n, mercenary>mercenaire*n, missionary>missionnaire*n, notary>notaire*n, voluntary>volontaire",
  },
  {
    id: "or", en: ["-or", "-our"], fr: ["-eur"], pos: "noun", gender: "m",
    title: "-or / -our → -eur",
    tip: "Swap -or (or British -our) for -eur: actor → acteur, colour → couleur. People who do things are masculine; feelings and qualities (*) are often feminine: la couleur, une erreur.",
    words: "actor>acteur, doctor>docteur, professor>professeur, director>directeur, author>auteur, motor>moteur, creator>créateur, inventor>inventeur, inspector>inspecteur, instructor>instructeur, monitor>moniteur, navigator>navigateur, operator>opérateur, orator>orateur, projector>projecteur, protector>protecteur, radiator>radiateur, reactor>réacteur, senator>sénateur, spectator>spectateur, tractor>tracteur, governor>gouverneur, aviator>aviateur, collector>collecteur, decorator>décorateur, elector>électeur, educator>éducateur, gladiator>gladiateur, ventilator>ventilateur, calculator>calculateur, commentator>commentateur, conservator>conservateur, coordinator>coordinateur, dictator>dictateur, distributor>distributeur, exporter>exportateur*skip, illustrator>illustrateur, imitator>imitateur, indicator>indicateur, initiator>initiateur, interlocutor>interlocuteur, mediator>médiateur, narrator>narrateur, organiser>organisateur*skip, predecessor>prédécesseur, successor>successeur, possessor>possesseur, aggressor>agresseur, confessor>confesseur, oppressor>oppresseur, sculptor>sculpteur, administrator>administrateur, animator>animateur, collaborator>collaborateur, contributor>contributeur, detector>détecteur, factor>facteur, investigator>investigateur, legislator>législateur, moderator>modérateur, negotiator>négociateur, observer>observateur*skip, persecutor>persécuteur, regulator>régulateur, supervisor>superviseur, visitor>visiteur, colour>couleur*f, error>erreur*f, honour>honneur, horror>horreur*f, odour>odeur*f, favour>faveur*f, terror>terreur*f, tumour>tumeur*f, vapour>vapeur*f, vigour>vigueur*f, ardour>ardeur*f, candour>candeur*f, splendour>splendeur*f, rigour>rigueur*f",
  },
  {
    id: "ize", en: ["-ize", "-ise"], fr: ["-iser"], pos: "verb",
    title: "-ize / -ise → -iser (doing words)",
    tip: "Swap -ize for -iser: organize → organiser. It's a normal -er verb: j'organise, nous organisons.",
    words: "organize>organiser, authorize>autoriser, capitalize>capitaliser, characterize>caractériser, centralize>centraliser, civilize>civiliser, colonize>coloniser, dramatize>dramatiser, finalize>finaliser, generalize>généraliser, harmonize>harmoniser, hospitalize>hospitaliser, humanize>humaniser, hypnotize>hypnotiser, idealize>idéaliser, immobilize>immobiliser, individualize>individualiser, industrialize>industrialiser, maximize>maximiser, minimize>minimiser, mobilize>mobiliser, modernize>moderniser, monopolize>monopoliser, moralize>moraliser, neutralize>neutraliser, normalize>normaliser, optimize>optimiser, personalize>personnaliser, polarize>polariser, popularize>populariser, privatize>privatiser, reorganize>réorganiser, revitalize>revitaliser, socialize>socialiser, specialize>spécialiser, standardize>standardiser, stabilize>stabiliser, sterilize>stériliser, symbolize>symboliser, synchronize>synchroniser, synthesize>synthétiser, terrorize>terroriser, utilize>utiliser, visualize>visualiser, baptize>baptiser, crystallize>cristalliser, equalize>égaliser, memorize>mémoriser, categorize>catégoriser, criminalize>criminaliser, democratize>démocratiser, familiarize>familiariser, fertilize>fertiliser, globalize>globaliser, legalize>légaliser, localize>localiser, marginalize>marginaliser, mechanize>mécaniser, militarize>militariser, naturalize>naturaliser, pulverize>pulvériser, rationalize>rationaliser, scandalize>scandaliser, theorize>théoriser, tranquillize>tranquilliser, urbanize>urbaniser, vaporize>vaporiser",
  },
  {
    id: "ate", en: ["-ate"], fr: ["-er"], pos: "verb",
    title: "-ate → -er (doing words)",
    tip: "Drop -ate, add -er: create → créer, celebrate → célébrer. Normal -er verbs: je crée, tu célèbres.",
    words: "create>créer, celebrate>célébrer, separate>séparer, calculate>calculer, accelerate>accélérer, accumulate>accumuler, activate>activer, appreciate>apprécier, circulate>circuler, decorate>décorer, eliminate>éliminer, estimate>estimer, exaggerate>exagérer, fascinate>fasciner, frustrate>frustrer, generate>générer, hesitate>hésiter, illustrate>illustrer, imitate>imiter, irritate>irriter, manipulate>manipuler, motivate>motiver, negotiate>négocier, operate>opérer, participate>participer, penetrate>pénétrer, regulate>réguler, simulate>simuler, speculate>spéculer, stimulate>stimuler, terminate>terminer, tolerate>tolérer, vibrate>vibrer, anticipate>anticiper, articulate>articuler, cultivate>cultiver, dictate>dicter, discriminate>discriminer, dominate>dominer, emigrate>émigrer, immigrate>immigrer, inaugurate>inaugurer, infiltrate>infiltrer, innovate>innover, integrate>intégrer, meditate>méditer, migrate>migrer, mutilate>mutiler, narrate>narrer, orchestrate>orchestrer, perpetrate>perpétrer, precipitate>précipiter, saturate>saturer, stipulate>stipuler, ventilate>ventiler, alternate>alterner, compensate>compenser, concentrate>concentrer, formulate>formuler, hydrate>hydrater, liquidate>liquider, moderate>modérer, illuminate>illuminer, incorporate>incorporer, intimidate>intimider, renovate>rénover",
  },
  {
    id: "el", en: ["-al"], fr: ["-el"], pos: "adj",
    title: "-ial / -ual / -nal → -el",
    tip: "When the English word ends in -ial, -ual or -onal, French uses -el: natural → naturel, personal → personnel (double n!). For a girl it's -elle.",
    words: "natural>naturel, personal>personnel, official>officiel, essential>essentiel, professional>professionnel, traditional>traditionnel, individual>individuel, exceptional>exceptionnel, cultural>culturel, annual>annuel, artificial>artificiel, conditional>conditionnel, confidential>confidentiel, criminal>criminel, eternal>éternel, formal>formel, fraternal>fraternel, habitual>habituel, industrial>industriel, intellectual>intellectuel, manual>manuel, maternal>maternel, mortal>mortel, mutual>mutuel, operational>opérationnel, optional>optionnel, partial>partiel, paternal>paternel, potential>potentiel, rational>rationnel, real>réel, sensational>sensationnel, sensual>sensuel, spiritual>spirituel, structural>structurel, superficial>superficiel, textual>textuel, universal>universel, virtual>virtuel, visual>visuel, accidental>accidentel, additional>additionnel, conceptual>conceptuel, constitutional>constitutionnel, contextual>contextuel, continual>continuel, emotional>émotionnel, exponential>exponentiel, gradual>graduel, institutional>institutionnel, intentional>intentionnel, occasional>occasionnel, proportional>proportionnel, residual>résiduel, ritual>rituel, sequential>séquentiel, substantial>substantiel",
  },
];

/** Parse every rule into a flat list, in learning order (rule order, then list order). */
export function frenchCognates(): Cognate[] {
  const out: Cognate[] = [];
  for (const r of FRENCH_RULES) {
    for (const raw of r.words.split(",")) {
      const item = raw.trim();
      if (!item || item.includes("*skip")) continue;
      const [pair, flag] = item.split("*");
      const [en, fr = en] = pair.split(">").map((s) => s.trim());
      let pos: Pos = r.pos;
      let gender = r.gender;
      if (flag === "f" || flag === "m") gender = flag;
      if (flag === "n") { pos = "noun"; gender = "m"; }
      out.push({ en, fr, pos, gender, rule: r.id });
    }
  }
  return out;
}

/** Simple French sentences with one gap, per kind of word. ___ = the word. */
export function framesFor(c: Cognate): string[] {
  switch (c.pos) {
    case "noun":
      return c.gender === "f"
        ? ["C'est une ___ importante.", "Voici une ___ intéressante.", "Je pense à une ___."]
        : ["C'est un ___ important.", "Voici un ___ intéressant.", "Je pense à un ___."];
    case "person":
      return ["Il est ___.", "Elle est ___.", "Mon ami est ___."];
    case "adj":
      return ["C'est très ___.", "Il est vraiment ___.", "Ce n'est pas ___."];
    case "adv":
      return ["Il a répondu ___.", "Elle a parlé ___.", "Ils ont travaillé ___."];
    case "verb":
      return ["Je veux ___.", "Il faut ___.", "Nous allons ___."];
  }
}

/** Lowercase, no accents, no punctuation/extra spaces — for "almost right" checks. */
export function looseFr(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, "'").replace(/[.!?,;:]/g, "").replace(/\s+/g, " ").trim();
}
/** Lowercase, same accents, tidy spaces/punctuation — for "exactly right". */
export function tidyFr(s: string): string {
  return s.toLowerCase().normalize("NFC").replace(/[’']/g, "'").replace(/[.!?,;:]/g, "").replace(/\s+/g, " ").trim();
}
