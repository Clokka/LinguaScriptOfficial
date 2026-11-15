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
];
