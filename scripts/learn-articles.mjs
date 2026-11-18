// Articles for /learn/* (static HTML, same look as the /words pages; rendered by
// scripts/word-pages.mjs). All text written by LinguaScript; every claim about
// research cites a source in `sources`. Keep it honest: say where research is
// debated, never present a theory as settled fact.

const S = {
  krashen82: "Krashen, S. (1982). <i>Principles and Practice in Second Language Acquisition</i>. Oxford: Pergamon.",
  krashen85: "Krashen, S. (1985). <i>The Input Hypothesis: Issues and Implications</i>. London: Longman.",
  krashen98: "Krashen, S. (1998). Comprehensible output? <i>System</i>, 26(2), 175–182.",
  huNation: "Hu, M. &amp; Nation, P. (2000). Unknown vocabulary density and reading comprehension. <i>Reading in a Foreign Language</i>, 13(1), 403–430.",
  nation06: "Nation, P. (2006). How large a vocabulary is needed for reading and listening? <i>Canadian Modern Language Review</i>, 63(1), 59–82.",
  webb09: "Webb, S. &amp; Rodgers, M. (2009). The lexical coverage of movies. <i>Applied Linguistics</i>, 30(3), 407–427.",
  mclaughlin87: "McLaughlin, B. (1987). <i>Theories of Second-Language Learning</i>. London: Edward Arnold.",
  swain85: "Swain, M. (1985). Communicative competence: Some roles of comprehensible input and comprehensible output in its development. In S. Gass &amp; C. Madden (Eds.), <i>Input in Second Language Acquisition</i> (pp. 235–253). Rowley, MA: Newbury House.",
  swain95: "Swain, M. (1995). Three functions of output in second language learning. In G. Cook &amp; B. Seidlhofer (Eds.), <i>Principle and Practice in Applied Linguistics</i> (pp. 125–144). Oxford: Oxford University Press.",
  swainLapkin95: "Swain, M. &amp; Lapkin, S. (1995). Problems in output and the cognitive processes they generate: A step towards second language learning. <i>Applied Linguistics</i>, 16(3), 371–391.",
  schmidt90: "Schmidt, R. (1990). The role of consciousness in second language learning. <i>Applied Linguistics</i>, 11(2), 129–158.",
  long96: "Long, M. (1996). The role of the linguistic environment in second language acquisition. In W. Ritchie &amp; T. Bhatia (Eds.), <i>Handbook of Second Language Acquisition</i> (pp. 413–468). San Diego: Academic Press.",
  west53: "West, M. (1953). <i>A General Service List of English Words</i>. London: Longman.",
  zipf49: "Zipf, G. K. (1949). <i>Human Behavior and the Principle of Least Effort</i>. Cambridge, MA: Addison-Wesley.",
  ngsl: "Browne, C., Culligan, B. &amp; Phillips, J. (2013). The New General Service List. newgeneralservicelist.com.",
  freqwords: "Dave, H. FrequencyWords: word frequency lists from OpenSubtitles 2018 (CC BY-SA 4.0). github.com/hermitdave/FrequencyWords.",
  coe20: "Council of Europe (2020). <i>Common European Framework of Reference for Languages: Learning, Teaching, Assessment. Companion Volume</i>. Strasbourg: Council of Europe.",
  miltonAlexiou09: "Milton, J. &amp; Alexiou, T. (2009). Vocabulary size and the Common European Framework of Reference for Languages. In B. Richards et al. (Eds.), <i>Vocabulary Studies in First and Second Language Acquisition</i>. Basingstoke: Palgrave Macmillan.",
  milton10: "Milton, J. (2010). The development of vocabulary breadth across the CEFR levels. In I. Bartning, M. Martin &amp; I. Vedder (Eds.), <i>Communicative Proficiency and Linguistic Development</i> (EUROSLA Monographs Series 1, pp. 211–232). European Second Language Association.",
  lauferRK10: "Laufer, B. &amp; Ravenhorst-Kalovski, G. C. (2010). Lexical threshold revisited: Lexical text coverage, learners' vocabulary size and reading comprehension. <i>Reading in a Foreign Language</i>, 22(1), 15–30.",
  goulden90: "Goulden, R., Nation, P. &amp; Read, J. (1990). How large can a receptive vocabulary be? <i>Applied Linguistics</i>, 11(4), 341–363.",
  laufer98: "Laufer, B. (1998). The development of passive and active vocabulary in a second language: Same or different? <i>Applied Linguistics</i>, 19(2), 255–271.",
  webb08: "Webb, S. (2008). Receptive and productive vocabulary sizes of L2 learners. <i>Studies in Second Language Acquisition</i>, 30(1), 79–95.",
  ebbinghaus: "Ebbinghaus, H. (1885). <i>Über das Gedächtnis</i> (Memory: A Contribution to Experimental Psychology). Leipzig: Duncker &amp; Humblot.",
  cepeda06: "Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T. &amp; Rohrer, D. (2006). Distributed practice in verbal recall tasks: A review and quantitative synthesis. <i>Psychological Bulletin</i>, 132(3), 354–380.",
  roediger06: "Roediger, H. L. &amp; Karpicke, J. D. (2006). Test-enhanced learning: Taking memory tests improves long-term retention. <i>Psychological Science</i>, 17(3), 249–255.",
  lomb: "Lomb, K. (2008). <i>Polyglot: How I Learn Languages</i> (ed. S. Alkire). TESL-EJ. Originally published in Hungarian as <i>Így tanulok nyelveket</i> (1970).",
};

// A sentence coloured the way LinguaScript colours subtitles: g = known, r = new.
const colouredLine = (parts, lang) => `<p class="demo" lang="${lang}" translate="no">${parts.map(([w, t]) => `<span class="${t}">${w}</span>`).join(" ")}</p>`;

export const ARTICLES = [
  {
    slug: "comprehensible-input",
    title: "What Is Comprehensible Input? A Simple Guide",
    desc: "Comprehensible input means understanding messages a little above your level. What Krashen said, how much you must understand, and how to find it.",
    h1: "What is comprehensible input?",
    lead: "<strong>Comprehensible input</strong> is language you can understand, even though it's a little above your level. The idea is that we pick up a language mainly by understanding messages, not by memorising rules first.",
    answer: "<strong>In one sentence:</strong> comprehensible input is listening or reading where you understand almost everything, so your brain can work out the few new words and patterns from context. The term comes from linguist Stephen Krashen in the late 1970s and 1980s.",
    sections: [
      { id: "idea", h2: "The idea in plain English", html: `
<p class="body">Think about how a child learns their first language. Nobody hands them a grammar book. They hear thousands of hours of speech that is <strong>about things they can see and already understand</strong>: "Look, a dog! The dog is running." Because the situation makes the meaning clear, the words and the grammar slowly stick.</p>
<p class="body">Stephen Krashen argued that adults learning a second language work in a similar way. He called this the <strong>Input Hypothesis</strong>: we acquire language when we understand messages that contain something just beyond what we know. He wrote it as <strong>i + 1</strong>, where <i>i</i> is your current level and <i>+1</i> is the next small step.</p>
${colouredLine([["Mi", "g"], ["perro", "g"], ["siempre", "g"], ["duerme", "r"], ["en", "g"], ["el", "g"], ["sofá", "g"]], "es")}
<p class="body" style="font-size:14px">If you know every word except <span class="r">duerme</span>, the rest of the sentence ("My dog always ___ on the sofa") almost tells you it means <i>sleeps</i>. That's i + 1.</p>` },
      { id: "krashen", h2: "Krashen's five hypotheses (short version)", html: `
<p class="body">The Input Hypothesis is one part of a bigger theory Krashen called the <strong>Monitor Model</strong>. In short:</p>
<div class="mist">
<div><b>1. Acquisition vs learning</b>"Acquiring" a language happens without effort, through meaning. "Learning" is studying rules on purpose. Krashen said acquisition is what makes you fluent.</div>
<div><b>2. The Monitor</b>Rules you learned on purpose act like an editor: useful when you have time to check your writing, less useful in fast conversation.</div>
<div><b>3. Natural order</b>Some grammar tends to be acquired in a predictable order, whatever order a textbook teaches it in.</div>
<div><b>4. Input</b>We acquire language by understanding messages slightly above our level (i + 1).</div>
<div><b>5. Affective filter</b>Stress, boredom and fear act like a filter that blocks input. Relaxed and interested learners take in more.</div>
</div>` },
      { id: "how-much", h2: "How much do you need to understand?", html: `
<p class="body">"Comprehensible" needs a number, and vocabulary research gives one. Studies of reading found that learners understand a text well when they know about <strong>98% of the words</strong> in it, which is about 1 unknown word in every 50 (Hu &amp; Nation, 2000). With <strong>95%</strong> (1 in 20), many people still follow the story, but it takes more effort.</p>
<table class="need"><caption class="sr">Share of words known and what it feels like</caption><thead><tr><th>Words you know</th><th>What it feels like</th></tr></thead><tbody>
<tr><td><strong>98%</strong></td><td>Comfortable. New words are easy to guess from context.</td></tr>
<tr><td><strong>95%</strong></td><td>Hard work, but you follow the main story.</td></tr>
<tr><td><strong>90%</strong></td><td>1 word in 10 is unknown. For most people, too much.</td></tr>
</tbody></table>
<p class="body">For films, one study estimated that you need about <strong>3,000 word families</strong> (plus names) to know 95% of the words, and about 6,000 for 98% (Webb &amp; Rodgers, 2009). That's why <a href="/words">learning the most common words first</a> matters so much: they unlock comprehensible input faster than anything else.</p>` },
      { id: "debate", h2: "Is it true? What critics say", html: `
<p class="body">Almost everyone agrees that <strong>lots of understandable input is essential</strong>. The debate is about whether it's <i>enough</i>:</p>
<ul class="body">
<li>Critics such as Barry McLaughlin (1987) pointed out that "i + 1" is hard to measure or test: nobody can say exactly what your +1 is.</li>
<li>Researchers like Merrill Swain found that learners who got years of input could understand very well but still made errors when speaking and writing. That led to the idea of <a href="/learn/comprehensible-output">comprehensible output</a> and the <a href="/learn/output-hypothesis">output hypothesis</a>.</li>
<li>Many researchers today think noticing, practice and some explicit teaching speed things up, on top of input.</li>
</ul>
<p class="body">The fair summary: comprehensible input is the <strong>foundation</strong>, not the whole house.</p>` },
      { id: "find", h2: "How to get comprehensible input every day", html: `
<ol class="steps">
<li><b>Choose things you actually enjoy.</b> Interest keeps the "affective filter" low and keeps you coming back. A cooking channel you love beats a boring textbook dialogue.</li>
<li><b>Aim for about 95–98% known words.</b> If you're lost every few seconds, pick something easier or turn on subtitles in both languages.</li>
<li><b>Mix watching, listening and reading.</b> Films and YouTube give you context from the pictures; podcasts train your ears anywhere; reading lets you go at your own speed.</li>
<li><b>Re-watch and re-read.</b> The second time, more is comprehensible, so you can notice more.</li>
<li><b>Catch the new words.</b> Save the few unknown words and review them, so they're known next time.</li>
</ol>
<p class="body">LinguaScript is built around this: it shows how many words of a video you already know, recommends videos at roughly 95–98% for you, and colours every word red (new) to green (known) as you learn. Read about the full approach in <a href="/learn/kato-lomb-chameleon-method">the Chameleon Method</a>.</p>` },
    ],
    faqs: [
      ["Who created the idea of comprehensible input?", "The linguist Stephen Krashen, in his Input Hypothesis, part of the Monitor Model he developed in the late 1970s and 1980s."],
      ["What does i + 1 mean?", "i is your current level of the language and +1 is the next small step. Input at i + 1 is mostly understood, with a little that is new."],
      ["Is watching TV comprehensible input?", "It is when you understand most of it. A show far above your level is just noise; one where you know about 95–98% of the words, especially with subtitles, is excellent input."],
      ["Is comprehensible input enough on its own?", "It's the foundation, but many researchers think speaking and writing (output), noticing and some study of grammar help you get accurate faster."],
    ],
    sources: [S.krashen82, S.krashen85, S.huNation, S.nation06, S.webb09, S.mclaughlin87, S.swain85],
  },

  {
    slug: "comprehensible-output",
    title: "What Is Comprehensible Output? (And How to Practise It)",
    desc: "Comprehensible output means speaking or writing so others understand you. What it is, why it helps you learn, and 7 easy ways to practise it.",
    h1: "What is comprehensible output?",
    lead: "<strong>Comprehensible output</strong> means producing language (speaking or writing) that other people can understand, and pushing yourself to say it more clearly and correctly when they can't.",
    answer: "<strong>In one sentence:</strong> comprehensible output is the speaking-and-writing partner of <a href=\"/learn/comprehensible-input\">comprehensible input</a>: when you try to say something and get stuck, you notice exactly what you don't know yet, and that makes the next piece of input much more useful. The idea comes from linguist Merrill Swain (1985).",
    sections: [
      { id: "story", h2: "Where the idea came from", html: `
<p class="body">In Canada, many English-speaking children go to <strong>French immersion</strong> schools, where most lessons are taught in French. After years of this, Merrill Swain and her colleagues noticed something surprising. The students <strong>understood French extremely well</strong>, close to native speakers of their age, but their <strong>speaking and writing</strong> still had many grammar errors.</p>
<p class="body">They had plenty of comprehensible input. What they had much less of was the need to <strong>produce</strong> French: they could often get their meaning across without being precise, and they didn't speak French as much as English. Swain concluded that input alone wasn't enough for accuracy, and that learners also need to be <strong>pushed to produce</strong> language others understand (Swain, 1985).</p>` },
      { id: "what", h2: "Comprehensible output vs just talking", html: `
<p class="body">Not all speaking counts. The key word is <strong>pushed</strong>. Pushed output is when you have to be precise, because the listener or reader needs to understand.</p>
<table class="vs"><caption class="sr">Easy output compared with pushed output</caption><thead><tr><th></th><th>Easy output</th><th>Pushed (comprehensible) output</th></tr></thead><tbody>
<tr><td>Example</td><td>"Yesterday… cinema… good film."</td><td>"Yesterday I went to the cinema and saw a really good film."</td></tr>
<tr><td>What you use</td><td>Words you already know well</td><td>Grammar and words you're not sure about yet</td></tr>
<tr><td>What you learn</td><td>Fluency with what you have</td><td>Where your gaps are, and how to fill them</td></tr>
</tbody></table>` },
      { id: "why", h2: "Why output helps you learn", html: `
<div class="mist">
<div><b>You notice the gap</b>When you try to say "I would have gone" and can't, you notice the missing grammar. Next time you hear it in a film, it jumps out.</div>
<div><b>You test your guesses</b>Each sentence is an experiment: "Is this how you say it?" A puzzled face or a correction tells you the answer.</div>
<div><b>You think about the language</b>Writing especially gives you time to ask why: which tense, which word order, which word fits best.</div>
<div><b>Words become yours</b>Recognising a word when you hear it is easier than using it. Output turns passive words into active ones.</div>
</div>
<p class="body">These are the three "functions of output" Swain described later (noticing, hypothesis testing and reflection), explained in full in <a href="/learn/output-hypothesis">the output hypothesis</a>, plus the everyday experience that using words makes them stick.</p>` },
      { id: "practise", h2: "7 easy ways to practise comprehensible output", html: `
<ol class="steps">
<li><b>Talk to yourself.</b> Describe what you're doing as you cook or walk: "Now I'm cutting the onions." No audience, no stress. Polyglot Kató Lomb recommended exactly this.</li>
<li><b>Retell what you watched.</b> After an episode or video, summarise it out loud in one minute. You'll instantly find the words you were missing.</li>
<li><b>Write three sentences a day.</b> Use one or two words you learned that day. Short and daily beats long and rare.</li>
<li><b>Keep a "gap list".</b> Every time you get stuck, note what you wanted to say in your own language. Look it up later, then listen for it.</li>
<li><b>Get feedback.</b> A tutor, a language exchange partner or a careful AI check can show you what wasn't clear.</li>
<li><b>Record yourself.</b> Listen back a day later. You'll hear things you didn't notice while speaking.</li>
<li><b>Recycle input into output.</b> Steal phrases from the shows you watch and use them in your own sentences that same day.</li>
</ol>` },
      { id: "balance", h2: "Input first, output alongside", html: `
<p class="body">Output doesn't replace input: you can't say what you've never heard. Most learners do best with <strong>lots of input</strong> (watching, listening, reading) and <strong>regular, short output</strong> (writing and speaking a few minutes a day) using the words that input gave them.</p>
<p class="body">That's the balance behind <a href="/learn/kato-lomb-chameleon-method">the Chameleon Method</a>: you collect new words while watching and reading, then use them in writing and speaking, and using a word correctly counts as a review, moving it from red (new) towards green (known).</p>` },
    ],
    faqs: [
      ["Who came up with comprehensible output?", "Merrill Swain, a Canadian linguist, first described it in 1985 after studying French immersion students in Canada."],
      ["What is the difference between comprehensible input and comprehensible output?", "Input is language you understand (listening and reading). Output is language you produce (speaking and writing) that others can understand."],
      ["Should beginners speak from day one?", "Beginners need input first, but short, low-pressure output (talking to yourself, writing a few simple sentences) can start early and helps words stick."],
      ["Does writing count as output?", "Yes. Writing is output, and because you have time to think, it's especially good for noticing gaps and reflecting on grammar."],
    ],
    sources: [S.swain85, S.swain95, S.swainLapkin95, S.lomb],
  },

  {
    slug: "output-hypothesis",
    title: "The Output Hypothesis: Swain's Theory Explained",
    desc: "Merrill Swain's output hypothesis: why speaking and writing help you learn, its three functions, the evidence and the debate, in plain English.",
    h1: "The output hypothesis, explained",
    lead: "The <strong>output hypothesis</strong> says that producing language, by speaking or writing, is not just the result of learning. It can be part of <strong>how</strong> we learn, because it makes us process language more deeply than listening or reading do.",
    answer: "<strong>In one sentence:</strong> Merrill Swain proposed that when learners are pushed to speak or write, they notice gaps in what they know, test their guesses about the language, and think about how it works, and these three things drive learning. It's usually seen as a partner to Krashen's <a href=\"/learn/comprehensible-input\">input hypothesis</a>, not a replacement.",
    sections: [
      { id: "background", h2: "Background: why a new hypothesis?", html: `
<p class="body">In the 1980s, Stephen Krashen's input hypothesis was very influential: understand enough messages and the language will come. Merrill Swain's research with French immersion students in Canada challenged the "enough" part. The students had years of rich input and excellent comprehension, but their grammar when speaking and writing stayed less accurate (Swain, 1985).</p>
<p class="body">Her explanation: when you <i>listen</i>, you can often understand from a few key words and the context, without processing every bit of grammar. When you have to <i>produce</i> a sentence, you can't skip anything. You must choose the tense, the word order, the ending. Output forces deeper processing. Swain first called this <a href="/learn/comprehensible-output">comprehensible output</a>.</p>` },
      { id: "functions", h2: "The three functions of output", html: `
<p class="body">Swain (1995) described three ways output helps:</p>
<ol class="steps">
<li><b>Noticing (the "trigger" function).</b> While trying to say something, you realise you don't know how. That moment makes you pay attention to the missing form the next time you hear or read it. This links to Richard Schmidt's (1990) idea that we learn what we notice.</li>
<li><b>Hypothesis testing.</b> Every sentence you say is a small experiment: "I think this is how it works." If the listener understands, the guess is confirmed; if they look confused or correct you, you adjust.</li>
<li><b>Metalinguistic reflection.</b> Output gives you something to think and talk about: "Why is it <i>was</i> here and not <i>were</i>?" Reflecting on your own language, alone or with others, helps you understand the system.</li>
</ol>
<div class="card"><p style="margin:0 0 6px;font-weight:700">Example: noticing in action</p>
<p style="margin:0;color:var(--muted)">You want to say "If I had known, I would have come" in Spanish and get stuck. That evening in a series you hear <span lang="es" translate="no"><b>"Si lo hubiera sabido, habría venido."</b></span> Because you tried and failed earlier, this time you notice it, and it sticks.</p></div>` },
      { id: "evidence", h2: "What the research shows", html: `
<p class="body">In one well-known study, Swain and Lapkin (1995) asked learners to think aloud while writing. They found learners often <strong>noticed problems</strong> in their own writing and then worked through them, which is exactly the process the hypothesis predicts. Later studies of learners working together on writing tasks found that what they discussed while solving language problems was often remembered afterwards.</p>
<p class="body">The output hypothesis also sits close to Michael Long's <strong>interaction hypothesis</strong> (1996): conversations where you have to clear up misunderstandings ("Sorry, what do you mean?") give you both input and pushed output at the same time.</p>` },
      { id: "debate", h2: "The debate: is output really needed?", html: `
<div class="mist">
<div><b>Krashen's reply</b>Krashen (1998) argued that real pushed output is fairly rare in everyday learning, that people can acquire a lot with very little speaking, and that pushing nervous learners to speak can raise anxiety.</div>
<div><b>Hard to separate</b>Output and input usually come together: when you speak, you also get answers back. That makes it hard to prove which one caused the learning.</div>
<div><b>Where most researchers land</b>Today many see input and output as partners: input supplies the language; output helps you notice, test and make it your own, especially for accuracy.</div>
</div>` },
      { id: "use", h2: "How to use the output hypothesis", html: `
<ol class="steps">
<li><b>Output short and often.</b> Two minutes of speaking or three written sentences a day is enough to trigger noticing.</li>
<li><b>Push slightly beyond comfort.</b> Try to say the thing you're <i>not</i> sure how to say. That's where the learning is.</li>
<li><b>Close the loop with input.</b> After you get stuck, go back to videos, podcasts or books and listen for the missing piece.</li>
<li><b>Reflect.</b> Look at a corrected sentence and ask why. One "aha" is worth ten blind repeats.</li>
<li><b>Keep it low-stress.</b> Talking to yourself and private writing give all three functions without the fear of an audience.</li>
</ol>
<p class="body">This loop (input, try to produce, notice the gap, back to input) is the heart of <a href="/learn/kato-lomb-chameleon-method">the Chameleon Method</a>.</p>` },
    ],
    faqs: [
      ["Who proposed the output hypothesis?", "Merrill Swain, a linguist at the University of Toronto, first in 1985, developing it further in the 1990s."],
      ["What are the three functions of output?", "Noticing (realising a gap in your knowledge), hypothesis testing (trying out how you think the language works) and metalinguistic reflection (thinking and talking about the language)."],
      ["Is the output hypothesis the opposite of the input hypothesis?", "No. It accepts that input is essential but argues that producing language adds something input alone may not, especially accuracy."],
      ["What is the difference between comprehensible output and the output hypothesis?", "They are the same theory. Swain first called it comprehensible output (1985); 'output hypothesis' is the name used for the developed version with its three functions."],
    ],
    sources: [S.swain85, S.swain95, S.swainLapkin95, S.schmidt90, S.long96, S.krashen98, S.krashen85],
  },

  {
    slug: "kato-lomb-chameleon-method",
    title: "Kató Lomb's Three Pillars and the Chameleon Method",
    desc: "How polyglot Kató Lomb learned 16 languages by reading, writing and speaking for herself, and how the Chameleon Method adds films and podcasts.",
    h1: "Kató Lomb's three pillars, and the Chameleon Method",
    lead: "Kató Lomb was one of the world's first simultaneous interpreters, working in <strong>16 languages</strong>. She learned most of them on her own, with a simple routine built on three pillars. The Chameleon Method is that same routine, adapted for the internet.",
    answer: "<strong>In one sentence:</strong> Lomb learned by reading for herself, writing for herself and speaking to herself, always with material she enjoyed. The Chameleon Method keeps those exact three pillars, but the first one grows from \"read books\" to <strong>read, watch films and YouTube, and listen to podcasts</strong>, with every word coloured by how well you know it.",
    sections: [
      { id: "who", h2: "Who was Kató Lomb?", html: `
<p class="body">Kató Lomb (1909–2003) was a Hungarian interpreter and translator. She studied physics and chemistry, not languages, and started learning English in the 1930s because she needed work. Over her life she worked in 16 languages, and understood or translated even more. In 1970 she wrote a book about how she did it, <i>Így tanulok nyelveket</i>, published in English as <i>Polyglot: How I Learn Languages</i>.</p>
<p class="body">Her message was encouraging: she didn't believe in a special "talent" for languages. She famously summed up her view as a formula:</p>
<div class="card" style="text-align:center"><p style="margin:0;font-size:20px;font-weight:800">(Motivation + Time) ÷ Inhibition = Result</p>
<p style="margin:8px 0 0;color:var(--muted);font-size:14px">More interest and more time help. Fear of making mistakes holds you back.</p></div>` },
      { id: "pillars", h2: "Her three pillars", html: `
<p class="body">Lomb described three things she did "for herself" in every new language. She gave them Greek names, starting with <i>auto-</i> (self):</p>
<div class="mist">
<div><b>📖 Autolexia: reading for yourself</b>Reading books she chose herself, early on, even when they were hard. She preferred real books she was curious about to textbooks, and picked up words from context.</div>
<div><b>✍️ Autographia: writing for yourself</b>Writing in the language, even imperfectly, using the words she had just met in her reading.</div>
<div><b>🗣️ Autologia: speaking to yourself</b>Talking to herself in the language: describing what she saw on the street or what she was doing. No partner needed, and no fear of mistakes.</div>
</div>
<p class="body">Notice how well this fits later research. Reading lots of interesting text is <a href="/learn/comprehensible-input">comprehensible input</a>. Writing and talking to yourself are low-stress <a href="/learn/comprehensible-output">comprehensible output</a>. And doing it all "for yourself", with material you enjoy, keeps the inhibition in her formula low.</p>` },
      { id: "chameleon", h2: "The Chameleon Method: Lomb's pillars, online", html: `
<p class="body">Lomb had books and a radio. Today we have films, YouTube, podcasts and the whole internet. The Chameleon Method keeps her three pillars exactly, and updates the tools:</p>
<table class="vs"><caption class="sr">Kató Lomb's pillars compared with the Chameleon Method</caption><thead><tr><th></th><th>Kató Lomb (1970)</th><th>Chameleon Method (today)</th></tr></thead><tbody>
<tr><td>Pillar 1: input</td><td>📖 Read books you choose</td><td>📖🎬🎧 <b>Read, watch and listen</b>: films and series, YouTube, podcasts, websites and real books</td></tr>
<tr><td>Pillar 2: writing</td><td>✍️ Write for yourself</td><td>✍️ Write short texts using the new words you just met</td></tr>
<tr><td>Pillar 3: speaking</td><td>🗣️ Talk to yourself</td><td>🗣️ Speak for 1–3 minutes about what you watched, using those words</td></tr>
<tr><td>Finding new words</td><td>A dictionary and pencil</td><td>Tap any word for its meaning; it's saved with its sentence</td></tr>
<tr><td>Remembering them</td><td>Rereading</td><td>Reviews on a schedule, words coloured red → green</td></tr>
</tbody></table>
<p class="body">Why add films and podcasts? Because for most people they're the most enjoyable input there is, and enjoyment is the "motivation" in Lomb's formula. Films and video also give you <strong>pictures and situations</strong> that make the meaning clear, and podcasts let you get input while walking, commuting or cooking. Reading is still there; it just isn't the only door anymore.</p>` },
      { id: "colours", h2: "Why \"chameleon\"?", html: `
<p class="body">A chameleon changes colour to match its world. In the Chameleon Method, your words do too: every word you meet is coloured by how well you know it, in subtitles, on web pages and in your flashcards.</p>
<div class="ladder"><span style="color:#FF3B30;border-color:#FF3B3055">Red: new</span><span style="color:#FF8A00;border-color:#FF8A0055">Orange: learning</span><span style="color:#34C759;border-color:#34C75955">Green: known</span><span style="color:#FFD54A;border-color:#FFD54A55">Gold: review due</span><span style="color:#2F7BFF;border-color:#2F7BFF55">Blue: 100% known</span></div>
<p class="body">Words come in red from pillar 1 (watching, listening, reading). Pillars 2 and 3 are where you <strong>use</strong> them: using a red word correctly in writing or speech counts as a review and moves it towards green. Over weeks, the videos you watch literally turn from red to green as the language becomes yours.</p>` },
      { id: "routine", h2: "A Lomb-style daily routine (30 minutes)", html: `
<ol class="steps">
<li><b>20 minutes of input you enjoy.</b> A video, an episode or a podcast in the language, at a level where you understand most of it. Save the few new words.</li>
<li><b>5 minutes of writing.</b> Write three to five sentences about what you watched, using two of your new red words.</li>
<li><b>5 minutes of speaking.</b> Tell yourself (or your phone's recorder) the story out loud. Lomb would approve: no audience needed.</li>
<li><b>Tomorrow, start with a quick review</b> of yesterday's words, then repeat. Keep the time and the motivation high, and the inhibition low.</li>
</ol>
<p class="body">That's the whole method: lots of real input, a little output every day, and words you can see changing colour as you learn. Start with <a href="/words">the most common words</a> in your language, or <a href="/words/anki-and-quizlet">use flashcards with Anki or Quizlet</a> alongside it.</p>` },
    ],
    faqs: [
      ["How many languages did Kató Lomb speak?", "She worked professionally in 16 languages, and understood or translated several more; sources give totals of up to about 22 when those are included."],
      ["What are autolexia, autographia and autologia?", "Kató Lomb's names for reading for yourself, writing for yourself and speaking to yourself: the three habits she used to learn every language."],
      ["What is the Chameleon Method?", "LinguaScript's version of Lomb's three pillars for the internet age: read, watch and listen to real content; write and speak with the new words; and see every word coloured from red (new) to green (known) as you learn."],
      ["What was Kató Lomb's formula?", "(Motivation + Time) ÷ Inhibition = Result. Interest and time spent increase results; fear and inhibition reduce them."],
    ],
    sources: [S.lomb, S.krashen85, S.swain85],
  },
  {
    slug: "high-frequency-words",
    title: "High-Frequency Words: Why Learn Them First",
    desc: "High-frequency words are the few hundred words that make up most of any language. Real numbers for 6 languages, Zipf's law, and how LinguaScript uses them.",
    h1: "High-frequency words: why learn them first",
    lead: "<strong>High-frequency words</strong> are the words a language uses most often: <i>the, you, de, que, je, ich</i>. A few hundred of them make up around half of everything people say, which is why LinguaScript teaches them first.",
    answer: "<strong>In one sentence:</strong> because word use follows Zipf's law, the most common 100 words cover roughly half of real speech and the top 1,000 cover around three quarters, so learning words in frequency order gets you understanding real films, podcasts and conversations much sooner than learning words by topic. LinguaScript builds every list, recommendation and colour on this idea.",
    sections: [
      { id: "what", h2: "What are high-frequency words?", html: `
<p class="body">Count every word in thousands of films and TV series and sort them from most to least common. The words at the top are the <strong>high-frequency words</strong>. They're mostly small grammar words (<i>the, a, is, not, of</i>) plus the most useful everyday verbs, nouns and adjectives (<i>go, want, time, good</i>).</p>
<p class="body">The idea is old. In 1953 Michael West published the <strong>General Service List</strong>: about 2,000 English words chosen for teaching because they're so frequent and useful. Modern versions like the <strong>New General Service List</strong> (2013) do the same with huge computer-counted collections of text.</p>` },
      { id: "zipf", h2: "Zipf's law: why so few words do so much work", html: `
<p class="body">In the 1930s and 1940s, linguist George Kingsley Zipf noticed a pattern in every language he studied: the most common word appears about <strong>twice as often</strong> as the second, <strong>three times as often</strong> as the third, and so on. This is called <strong>Zipf's law</strong>.</p>
<p class="body">The result is a very steep curve: a small group of words is used all the time, and a huge "long tail" of words appears only now and then. That's great news for learners: you don't need 50,000 words to start understanding. You need the right few hundred first. <a href="/frequent-words">See the Zipf table</a>.</p>` },
      { id: "numbers", h2: "The real numbers, in six languages", html: (all) => {
        const L = [["es", "Spanish", "spanish"], ["fr", "French", "french"], ["de", "German", "german"], ["it", "Italian", "italian"], ["pt_br", "Portuguese (Brazil)", "portuguese"], ["en", "English", "english"]];
        const f = (n) => n.toLocaleString("en-GB");
        return `<p class="body">We measured this ourselves from film and TV subtitles (OpenSubtitles 2018). Each number is the share of all words people say that the top words cover:</p>
<table><caption class="sr">Share of real speech covered by the most common words</caption><thead><tr><th>Language</th><th>Top 100</th><th>Top 1,000</th><th>Top 3,000</th><th>Words for 50%</th></tr></thead><tbody>
${L.map(([k, n, slug]) => `<tr><td><a href="/words/${slug}">${n}</a></td><td><strong style="color:var(--green)">${all[k].coverage[100]}%</strong></td><td>${all[k].coverage[1000]}%</td><td>${all[k].coverage[3000]}%</td><td>${f(all[k].needFor[50])}</td></tr>`).join("")}
</tbody></table>
<p class="body">So in Spanish, just <strong>${f(all.es.needFor[50])} words</strong> make up half of everything said, and in French only <strong>${f(all.fr.needFor[50])}</strong>. These are word forms (<i>is</i> and <i>are</i> count separately), so the real number of dictionary words is even smaller.</p>`; } },
      { id: "enough", h2: "Is the top 1,000 enough?", html: `
<p class="body">It's a brilliant start, but not the finish line. To follow a film comfortably you need to know about <strong>95–98%</strong> of the words you hear (see <a href="/learn/comprehensible-input">comprehensible input</a>). Research suggests that takes roughly <strong>3,000 word families</strong> for 95% of film dialogue and about 6,000–7,000 for 98% of spoken English (Webb &amp; Rodgers, 2009; Nation, 2006).</p>
<p class="body">So the plan is: <strong>learn the high-frequency words first</strong>, because each one pays off every day, then pick up the rest <strong>in context</strong>, from the shows, videos and podcasts you enjoy, where you meet the words that matter to <i>you</i>.</p>` },
      { id: "linguascript", h2: "How LinguaScript uses high-frequency words", html: `
<ol class="steps">
<li><b>Free frequency lists.</b> The <a href="/words">100, 1,000 and 3,000 most common words</a> in Spanish, French, German, Italian, Portuguese and English, with meanings, audio and a CSV for Anki or Quizlet.</li>
<li><b>Videos at your level.</b> LinguaScript counts how many words of a video you already know and recommends videos where you know about 95–98%: input that's comprehensible, not overwhelming.</li>
<li><b>Colour-coded words.</b> Every word in the subtitles is coloured by how well you know it: red (new), orange (learning), green (known), gold (review due), blue (100% known). High-frequency words turn green first, and you can watch it happen.</li>
<li><b>Flashcards in frequency order.</b> The "most common words" deck teaches the words that unlock the most of real speech first, on a spaced review schedule.</li>
</ol>
<p class="body">It's the <a href="/learn/kato-lomb-chameleon-method">Chameleon Method</a>: frequent words first, real content always, and a little writing and speaking to make the words your own.</p>` },
    ],
    faqs: [
      ["What are high-frequency words?", "The words a language uses most often. In film and TV subtitles, the top 100 make up roughly half of everything said, and the top 1,000 around three quarters."],
      ["How many high-frequency words should I learn first?", "Start with the top 100, then the top 1,000. After that, learn words in context from content you enjoy, aiming for about 3,000 word families to follow films comfortably."],
      ["What is Zipf's law?", "George Kingsley Zipf's observation that the most common word in a language appears about twice as often as the second, three times as often as the third, and so on, so a few words do most of the work."],
      ["Does LinguaScript use high-frequency words?", "Yes. LinguaScript's free word lists, video recommendations, colour-coded subtitles and flashcards all start from the most frequent words, measured from real film and TV subtitles."],
    ],
    sources: [S.zipf49, S.west53, S.ngsl, S.nation06, S.webb09, S.freqwords],
  },
  {
    slug: "cefr-vocabulary-size",
    title: "How Many Words for Each CEFR Level? A1 to C2",
    desc: "What research really says about vocabulary size from A1 to C2, why advanced levels need 8,000+ word families, and passive vs active vocabulary.",
    h1: "How many words do you need for each CEFR level?",
    lead: "There's no official word count for any CEFR level: the levels describe what you can <strong>do</strong>, not how many words you know. But researchers have measured how many words learners at each level usually <strong>recognise</strong>, and the numbers make a useful map.",
    answer: "<strong>In one sentence:</strong> learners typically recognise fewer than about 1,500 words at A1 and around 3,000 at B1, but the numbers climb fast after that: following most real speech takes about 6,000–7,000 word families and reading freely about 8,000–9,000, which is the territory of C1–C2 (Nation, 2006). These are research estimates, not official CEFR counts, and the words you can <i>use</i> are always fewer than the words you <i>recognise</i>.",
    sections: [
      { id: "levels", h2: "Words per CEFR level: what the research says", html: (all) => {
        const rows = [
          ["A1", 0, 1500, "Under 1,500", "Simple everyday phrases; introduce yourself"],
          ["A2", 1500, 2500, "1,500–2,500", "Routine tasks and simple exchanges"],
          ["B1", 2750, 3250, "2,750–3,250", "The main points of familiar topics; get by when travelling"],
          ["B2", 3250, 3750, "3,250–3,750", "Follow complex ideas; talk with fluent speakers with ease"],
          ["C1", 3750, 4500, "3,750–4,500+", "Use the language flexibly; catch implied meaning"],
          ["C2", 4500, 5000, "4,500–5,000 (test maximum)", "Understand almost everything you hear or read"],
        ];
        const bar = (lo, hi, i) => `<div style="position:relative;height:10px;border-radius:99px;background:#232329"><div style="position:absolute;left:${lo / 50}%;width:${Math.max(4, (hi - lo) / 50)}%;height:10px;border-radius:99px;background:${i >= 4 ? "#FFD54A" : "#34C759"};opacity:${i >= 4 ? 1 : 0.45 + i * 0.11}"></div></div>`;
        const f = (n) => n.toLocaleString("en-GB");
        return `<h3 style="margin:6px 0 10px;font-size:18px">1. How many of the 5,000 most frequent words learners recognise</h3>
<table class="need" style="max-width:none"><caption class="sr">Words recognised from the 5,000 most frequent words at each CEFR level</caption><thead><tr><th>Level</th><th>Of the top 5,000</th><th style="width:28%">The 5,000-word test</th><th>You can…</th></tr></thead><tbody>
${rows.map(([lv, lo, hi, label, can], i) => `<tr><td><strong style="font-size:18px">${lv}</strong></td><td><strong style="color:${i >= 4 ? "#FFD54A" : "#34C759"}">${label}</strong></td><td>${bar(lo, hi, i)}</td><td style="color:var(--muted);font-size:14px">${can}</td></tr>`).join("")}
</tbody></table>
<p class="body" style="font-size:14px">These figures come from tests that only checked the <strong>5,000 most frequent words</strong> (Milton &amp; Alexiou, 2009; Milton, 2010). That works well for A1–B2. At <strong style="color:#FFD54A">C1–C2</strong> learners reach the <strong>top of the test</strong>: knowing "nearly all 5,000" doesn't mean they know only 5,000. Their real vocabulary is much larger, as the next table shows. The researchers themselves call the ranges indicative, not requirements. "You can…" lines are our plain-English summary of the CEFR descriptions (Council of Europe, 2020).</p>
<h3 style="margin:22px 0 10px;font-size:18px">2. How many words real language takes</h3>
<table class="need" style="max-width:none"><caption class="sr">Vocabulary needed to understand real language, from research</caption><thead><tr><th>To understand…</th><th>You need about</th><th>Research</th></tr></thead><tbody>
<tr><td>95% of the words in films and TV</td><td><strong style="color:#34C759">3,000</strong> word families</td><td style="color:var(--muted);font-size:14px">Webb &amp; Rodgers, 2009</td></tr>
<tr><td>98% of everyday speech and films</td><td><strong style="color:#34C759">6,000–7,000</strong> word families</td><td style="color:var(--muted);font-size:14px">Nation, 2006; Webb &amp; Rodgers, 2009</td></tr>
<tr><td>Novels and newspapers without a dictionary (98%)</td><td><strong style="color:#2F7BFF">8,000–9,000</strong> word families</td><td style="color:var(--muted);font-size:14px">Nation, 2006; Laufer &amp; Ravenhorst-Kalovski, 2010</td></tr>
<tr><td>Educated adult native speaker</td><td><strong style="color:#2F7BFF">around 17,000</strong> word families</td><td style="color:var(--muted);font-size:14px">Goulden, Nation &amp; Read, 1990</td></tr>
</tbody></table>
<p class="body" style="font-size:14px">A <strong>word family</strong> is a base word plus its forms and close relatives (<i>use, uses, used, useful, useless</i>), so 8,000 families means many more individual words. Comfortable advanced use (C1–C2) sits in the 6,000–9,000-family range or above; no study gives one exact number per level.</p>
<p class="body">The good news is the start: because of <a href="/learn/high-frequency-words">Zipf's law</a>, in Spanish films and TV the top 1,000 word forms already cover <strong>${all.es.coverage[1000]}%</strong> of everything said, and the top 3,000 cover <strong>${all.es.coverage[3000]}%</strong>. Learn in frequency order and every word pays off from day one; the long tail comes from reading and watching.</p>
<p class="body" style="font-size:14px">On our <a href="/english/a1">English A1 guide</a> we say A1 is about 400–700 words: that's the words a beginner course teaches you to <i>use</i>. The research figures count words you <i>recognise</i>, which is always more.</p>`; } },
      { id: "passive-active", h2: "Passive vs active vocabulary", html: `
<div class="mist">
<div><b>Passive (receptive) vocabulary</b>Words you <strong>recognise</strong> when you hear or read them. It grows first and stays bigger: most learners recognise far more words than they can use (Laufer, 1998; Webb, 2008).</div>
<div><b>Active (productive) vocabulary</b>Words you can <strong>use</strong> yourself, in speaking and writing, without help. It grows when you practise producing the language: <a href="/learn/comprehensible-output">comprehensible output</a>.</div>
</div>
<p class="body">Both matter. Passive vocabulary lets you understand films, podcasts and conversations (<a href="/learn/comprehensible-input">comprehensible input</a>: Stephen Krashen's idea that we pick up a language by understanding messages, much as children pick up their first language). Active vocabulary lets you take part.</p>` },
      { id: "colours", h2: "What the chameleon colours mean", html: (all, h) => {
        const step = (tone, name, color, text) => `<div style="flex:1 1 140px;background:var(--card);border:1px solid var(--line);border-radius:18px;padding:14px;display:flex;flex-direction:column;gap:6px">${h.chameleon(tone, 64, name)}<b style="color:${color};font-size:17px">${name}</b><span style="color:var(--muted);font-size:14px">${text}</span></div>`;
        return `<p class="body">Every word you save in LinguaScript has a colour. The colours follow a word from "just met" to "yours for good":</p>
<div style="display:flex;flex-wrap:wrap;gap:10px;margin:14px 0">
${step("red", "Red", "#FF3B30", "New. You've met it and saved it. Passive, and still fragile.")}
${step("orange", "Orange", "#FF8A00", "Learning. You recognised it once. Still passive.")}
${step("green", "Green", "#34C759", "Known. You recognise it on your own: a stronger memory has started.")}
${step("gold", "Gold", "#FFD54A", "Review time. Just before you'd forget, we check it. Right answer: back to green.")}
${step("blue", "Blue", "#2F7BFF", "Long-term. Six well-timed reviews later, it's in long-term memory.")}
</div>
<p class="body">Red, orange and green mostly measure <strong>passive</strong> knowledge: can you recognise the word? Words become <strong>active</strong> when you use them in a lesson's wrap-up (say it to your coach, or write it in a sentence). In LinguaScript, using a new word correctly counts as a review too.</p>`; } },
      { id: "forgetting", h2: "Why words go gold: the forgetting curve", html: `
<p class="body">In 1885 Hermann Ebbinghaus measured how fast he forgot new material: very fast at first, then more slowly. That's the <strong>forgetting curve</strong>. He also found that each time you relearn something, you forget it more slowly afterwards. Later research confirmed that <strong>spaced</strong> reviews beat cramming (Cepeda et al., 2006) and that <strong>trying to remember</strong> strengthens memory more than rereading (Roediger &amp; Karpicke, 2006).</p>
<figure style="margin:16px 0;background:var(--card);border:1px solid var(--line);border-radius:18px;padding:16px">
<svg viewBox="0 0 600 240" role="img" aria-label="Illustration: without reviews memory drops fast; with spaced reviews it is topped up each time and falls more slowly" style="width:100%;height:auto;display:block">
<line x1="40" y1="200" x2="585" y2="200" stroke="#2A2A30"/><line x1="40" y1="14" x2="40" y2="200" stroke="#2A2A30"/>
<text x="44" y="12" fill="#8E8E98" font-size="12">memory</text><text x="540" y="222" fill="#8E8E98" font-size="12">time</text>
<path d="M40,24 C70,130 130,175 580,195" fill="none" stroke="#8E8E98" stroke-width="2.5" stroke-dasharray="6 6"/>
<path d="M40,24 Q55,72 70,78 L70,24 Q95,84 120,90 L120,24 Q155,74 190,78 L190,24 Q230,58 270,62 L270,24 Q320,46 370,50 L370,24 Q435,36 500,40" fill="none" stroke="#34C759" stroke-width="3"/>
<path d="M500,24 Q540,28 580,30" fill="none" stroke="#2F7BFF" stroke-width="3.5"/>
<g fill="#FFD54A"><circle cx="70" cy="24" r="6"/><circle cx="120" cy="24" r="6"/><circle cx="190" cy="24" r="6"/><circle cx="270" cy="24" r="6"/><circle cx="370" cy="24" r="6"/><circle cx="500" cy="24" r="6"/></g>
<g fill="#A1A1AA" font-size="11" text-anchor="middle"><text x="70" y="216">5 min</text><text x="120" y="216">1 day</text><text x="190" y="216">3 days</text><text x="270" y="216">7 days</text><text x="370" y="216">14 days</text><text x="500" y="216">30 days</text></g>
</svg>
<figcaption style="font-size:13px;color:var(--faint);margin-top:8px"><span style="color:#8E8E98">- - -</span> no reviews · <span style="color:#34C759">━</span> green, topped up at each <span style="color:#FFD54A">●</span> gold review · <span style="color:#2F7BFF">━</span> blue. An illustration of the idea, not measured data.</figcaption>
</figure>
<h3 style="margin:22px 0 10px;font-size:18px">The LinguaScript memory ladder</h3>
<ol class="steps">
<li><b>A word turns green.</b> You recognised it. Five minutes later it turns <b style="color:#FFD54A">gold</b>: the first quick check.</li>
<li><b>Get it right, it goes back to green</b> and waits longer: 1 day, then 3, 7, 14 and 30 days. Each gold comes just before you'd be likely to forget.</li>
<li><b>Six right answers in a row and it turns <span style="color:#2F7BFF">blue</span>.</b> Blue means long-term memory: reviews now come rarely (each gap 1.5× longer), so you keep it for a very long time with almost no effort.</li>
<li><b>Get one wrong?</b> No problem: it simply comes back sooner. Forgetting a little and remembering again is exactly what makes memories last.</li>
</ol>
<p class="body" style="font-size:14px">Six reviews is LinguaScript's design, built on the research above; nobody can promise a word is never forgotten, but each well-timed review makes forgetting slower.</p>` },
      { id: "plan", h2: "A realistic path from A1 to B1", html: `
<ol class="steps">
<li><b>Start with the most common words.</b> The <a href="/words">top 100</a> are about half of real speech; aim for the top 1,000 first.</li>
<li><b>Understand lots.</b> Watch and listen to things you enjoy where you know about 95–98% of the words.</li>
<li><b>Review a few minutes a day.</b> Let gold words come back on schedule instead of cramming.</li>
<li><b>Use your new words.</b> Two or three sentences or a one-minute voice note a day turns passive words into active ones.</li>
</ol>` },
    ],
    faqs: [
      ["How many words do I need for A1?", "Learners at A1 usually recognise fewer than about 1,500 words; beginner courses typically teach around 400–700 words to use. There is no official CEFR word count."],
      ["How many words do I need for B1 or B2?", "Studies that tested the 5,000 most frequent words found learners typically recognise around 2,750–3,250 of them at B1 and 3,250–3,750 at B2. These are indicative ranges, not exam requirements."],
      ["How many words do I need for C1 or C2?", "More than older 5,000-word tests can show. Understanding about 98% of everyday speech takes roughly 6,000–7,000 word families, and reading novels and newspapers comfortably about 8,000–9,000 (Nation, 2006). Educated native speakers know around 17,000 word families (Goulden, Nation and Read, 1990)."],
      ["What is the difference between passive and active vocabulary?", "Passive (receptive) vocabulary is the words you recognise when reading or listening; active (productive) vocabulary is the words you can use yourself when speaking or writing. Passive vocabulary is always larger."],
      ["What does a blue word mean in LinguaScript?", "Blue means a word has passed six spaced reviews in a row and is in long-term memory. Reviews then come only rarely, with each gap 1.5 times longer."],
    ],
    sources: [S.cepeda06, S.coe20, S.ebbinghaus, S.goulden90, S.krashen82, S.laufer98, S.lauferRK10, S.miltonAlexiou09, S.milton10, S.nation06, S.roediger06, S.webb08, S.webb09, S.freqwords],
  },
];
