/**
 * LinguaScript customer survey — builds a Google Form for you.
 * How: go to script.google.com → New project → paste this whole file → press ▶ Run
 * (choose createLinguaScriptSurvey) → allow access. The links appear in View → Logs.
 */
function createLinguaScriptSurvey() {
  var form = FormApp.create('LinguaScript Learner Survey');
  form.setDescription('Help us make LinguaScript better! It takes about 3 minutes. Your answers are anonymous.')
      .setProgressBar(true)
      .setCollectEmail(false);

  // 1 · Demographics
  form.addPageBreakItem().setTitle('1. About you');
  form.addMultipleChoiceItem().setTitle('How old are you?')
      .setChoiceValues(['Under 13', '13–17', '18–24', '25–34', '35–44', '45–54', '55+', 'Prefer not to say'])
      .setRequired(true);
  form.addListItem().setTitle('Where do you live?')
      .setChoiceValues(['UK', 'Ireland', 'Rest of Europe', 'USA / Canada', 'Latin America', 'Asia', 'Africa', 'Oceania', 'Other']);

  // 2 · Background
  form.addPageBreakItem().setTitle('2. Your background');
  form.addMultipleChoiceItem().setTitle('What best describes you?')
      .setChoiceValues(['School student', 'University student', 'Working full-time', 'Working part-time', 'Teacher / tutor', 'Retired'])
      .showOtherOption(true);
  form.addCheckboxItem().setTitle('Why are you learning a language? (tick all that apply)')
      .setChoiceValues(['School / exams', 'Travel', 'Work or career', 'Moving abroad / studying abroad', 'Family or partner', 'Films, TV and music', 'Just for fun'])
      .showOtherOption(true);

  // 3 · Competition & Industry
  form.addPageBreakItem().setTitle('3. Other apps you use');
  form.addCheckboxItem().setTitle('Which have you used to learn a language? (tick all that apply)')
      .setChoiceValues(['Duolingo', 'Language Reactor', 'LingQ', 'Migaku', 'Babbel', 'Busuu', 'Anki', 'ChatGPT / Claude / other AI', 'A teacher or tutor', 'None'])
      .showOtherOption(true);
  form.addMultipleChoiceItem().setTitle('How much do you spend on language learning each month?')
      .setChoiceValues(['Nothing', 'Under £5', '£5–£10', '£10–£20', 'Over £20']);

  // 4 · Brand Awareness & Perception
  form.addPageBreakItem().setTitle('4. LinguaScript and you');
  form.addMultipleChoiceItem().setTitle('How did you first hear about LinguaScript?')
      .setChoiceValues(['TikTok / Instagram / YouTube', 'Google search', 'Chrome Web Store', 'Google Play', 'Friend or family', 'Teacher or school', 'Haven\'t heard of it before'])
      .showOtherOption(true);
  form.addScaleItem().setTitle('How easy is LinguaScript to understand?')
      .setBounds(1, 5).setLabels('Very confusing', 'Very easy');
  form.addParagraphTextItem().setTitle('In 3 words, how would you describe LinguaScript?');

  // 5 · Product Feedback
  form.addPageBreakItem().setTitle('5. Your feedback');
  form.addGridItem().setTitle('Rank these features (1 = most useful)')
      .setRows(['Coloured words (red → green → gold)', 'Videos about my hobby', 'Tap a word for its meaning', 'Flashcard reviews', 'Chrome extension on any website', 'Android bubble'])
      .setColumns(['1', '2', '3', '4', '5', '6']);
  form.addScaleItem().setTitle('How likely are you to recommend LinguaScript to a friend?')
      .setBounds(0, 10).setLabels('Not at all likely', 'Extremely likely');
  form.addParagraphTextItem().setTitle('What is ONE thing we should add or fix?');

  Logger.log('Share this link: ' + form.getPublishedUrl());
  Logger.log('Edit the form: ' + form.getEditUrl());
}
