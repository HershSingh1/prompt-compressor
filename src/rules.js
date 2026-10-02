// Rule data and builders for the local compressor, based on prompt_token_efficiency_list.txt.
// Every rule has a level: 'standard' (meaning-preserving) or 'aggressive' (may soften or shift nuance).
// Rules never touch the "do not cut" words (negations, quantifiers, modals, numbers, names).

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const flex = (p) => esc(p).replace(/ /g, '\\s+').replace(/'/g, "['\u2019]");
const alt = (list) => [...list].sort((a, b) => b.length - a.length).map(flex).join('|');
const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').replace(/\u2019/g, "'");
const upperFirst = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const isUpper = (s) => /^[A-Z]/.test(s);
const SS = '(^|[.!?:]\\s+)'; // sentence start
const AT_SENTENCE_START = /(^|[.!?:]\s+)$/;

const pairs = (text) =>
  text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const [from, to] = l.split(' -> ');
    return [from.trim(), to.trim() === '(delete)' ? '' : to.trim()];
  });
const words = (text) => text.split('\n').map((l) => l.trim()).filter(Boolean);

const articleFor = (word) =>
  /^(?:[aeio]|un(?!i[ftvq]|iform|ion)|hour|honest|honou?r|heir)/i.test(word) && !/^(?:one|once)\b/i.test(word) ? 'an' : 'a';
const articleOnly = (art, word) => (isUpper(art) ? upperFirst(articleFor(word)) : articleFor(word));
const withArticle = (art, word) => `${articleOnly(art, word)} ${word}`;
const matchCase = (from, to) => (isUpper(from) && /^[a-z]/.test(to) ? upperFirst(to) : to);

const rule = (level, re, to) => ({ level, re, to });

// Delete phrases anywhere. Captures an optional leading article (fixed to a/an) and the next token.
const del = (level, list) =>
  rule(
    level,
    new RegExp(`(?:\\b(a|an)\\s+)?\\b(?:${alt(list)})(?!\\w)[,;]?\\s*(\\S*)`, 'gi'),
    (m, art, next, offset, str) => {
      const atStart = AT_SENTENCE_START.test(str.slice(0, offset));
      const tok = !art && isUpper(m) && atStart ? upperFirst(next) : next;
      return art && tok ? withArticle(art, tok) : tok;
    }
  );

// Delete phrases only at the start of a sentence (connectors, openers).
const delStart = (level, list, { afterComma = false } = {}) =>
  rule(
    level,
    new RegExp(`${afterComma ? '(^|[.!?:,]\\s+)' : SS}(${alt(list)})(?!\\w)[,;:]?\\s*(\\S?)`, 'gi'),
    (m, pre, phrase, next) => pre + (isUpper(phrase) && !pre.includes(',') ? next.toUpperCase() : next)
  );

// Delete whole short sentences/clauses: phrase must be followed by punctuation or end of line.
const delSentence = (level, list) =>
  rule(
    level,
    new RegExp(`${SS}(${alt(list)})(?=\\s*(?:[.!?,:;]|$))[,.!?:;]*\\s*(\\S?)`, 'gi'),
    (m, pre, phrase, next) => pre + (isUpper(phrase) ? next.toUpperCase() : next)
  );

// "phrase -> replacement" anywhere, preserving leading capital and fixing a/an.
const map = (level, list) => {
  const dict = new Map(list.map(([f, t]) => [norm(f), t]));
  return rule(
    level,
    new RegExp(`(?:\\b(a|an)\\s+)?\\b(${alt(list.map(([f]) => f))})(?!\\w)`, 'gi'),
    (m, art, phrase) => {
      const to = dict.get(norm(phrase));
      if (to === undefined) return m;
      if (!art) return matchCase(phrase, to);
      return to ? withArticle(art, to) : `${art} `;
    }
  );
};

// Same, but only at the start of a sentence.
const mapStart = (level, list) => {
  const dict = new Map(list.map(([f, t]) => [norm(f), t]));
  return rule(
    level,
    new RegExp(`${SS}(${alt(list.map(([f]) => f))})(?!\\w)`, 'gi'),
    (m, pre, phrase) => pre + matchCase(phrase, dict.get(norm(phrase)))
  );
};

// Sentence-start phrase -> "Label: " (keeps any text that follows).
const labels = (level, list) => {
  const dict = new Map(list.map(([f, t]) => [norm(f), t]));
  return rule(
    level,
    new RegExp(`${SS}(${alt(list.map(([f]) => f))})(?!\\w)\\s*:?\\s*(\\S?)`, 'gi'),
    (m, pre, phrase, next) => `${pre}${dict.get(norm(phrase))}: ${next}`
  );
};

// ---------------------------------------------------------------- data

const LABELS_STD = pairs(`
here is an example of what i want -> Example
here are some examples -> Examples
here is the input text -> Input
here is the document -> Doc
here is the document you will be working with -> Doc
here is the context -> Context
here is the background information -> Background
here is the question -> Q
here is the answer -> A
here is the output format i want -> Format
here are the requirements -> Requirements
here are the constraints -> Constraints
here is what i have so far -> Draft
here is my code -> Code
here is the error message i am getting -> Error
here is the stack trace -> Trace
use the following format -> Format
follow these steps -> Steps
follow these instructions -> Instructions
the audience for this is -> Audience
the tone should be -> Tone
the length should be -> Length
the output should be -> Output
the goal of this task is -> Goal
what i'm trying to achieve is -> Goal
the purpose of this is -> Purpose
i have a few questions -> Qs
one more thing -> Also
another thing i wanted to ask -> Also
to recap -> Recap
to summarize what we've discussed -> Recap
sorry, i meant to say -> Correction
let me rephrase that -> Rephrase
please see the attached -> Attached
please find attached -> Attached
`);

const LABELS_AGG = pairs(`
actually, scratch that -> Ignore previous
ignore what i said before -> Ignore previous
forget everything i told you -> Reset
let's start over -> Reset
i changed my mind -> Change
wait, one more thing -> Also
oh and -> Also
`);

// Short sentences/clauses that carry no instruction.
const CHATTER = words(`
thanks
thank you
thanks so much
thank you so much
thanks a lot
thanks in advance
thank you in advance
thank you very much
thanks for your help
thank you for your time and consideration
thank you for your time
hope that makes sense
does that make sense
i hope this finds you well
i hope this email finds you well
sorry to bother you
sorry for the confusion
let me know if you need anything
let me know if you have questions
let me know if you have any questions
please let me know if you have questions
please let me know if you have any questions
feel free to ask
feel free to ask questions
feel free to reach out
do not hesitate to contact me
don't hesitate to contact me
looking forward to your response
i look forward to hearing from you
i'll wait for your answer
hope this helps
take care
quick question
just a quick question
take your time
do your best
try your best
give it your best shot
i trust you
be as helpful as possible
listen carefully
read the following carefully
pay close attention to the following
make sure you read everything
i have a task for you
here is what i need
let's get started
let's begin
here is the text
below is the text
i know this is a lot
following up on my last message
going back to what i said earlier
as per my previous message
to follow up
you are a helpful, harmless, and honest assistant
you are an ai language model
you are a very smart and helpful ai
`);

const CHATTER_AGG = words(`
be as accurate as possible
write in complete sentences
use proper grammar
be polite
follow best practices
write clean code
you are a helpful assistant
i have attached
i am sharing
never mind
`);

const OPENERS = words(`
i would like you to
i'd like you to
i want you to
i need you to
i'm going to ask you to
what i want is for you to
i am hoping you can
i was just wondering if you could
i was wondering if you could
i would appreciate it if you could
i'd appreciate it if you could
i would appreciate it if you
i would be grateful if you could
would you be so kind as to
would you kindly
your job is to
your task is to
the goal here is to
today i want to
what i meant was
`);

const OPENERS_AGG = words(`
i am going to give you
i was wondering if
i have a question about
`);

const PERSONA_ADJ = words(`
highly experienced and professional
highly skilled and experienced
highly skilled
highly experienced
skilled and experienced
experienced and professional
world-class
very smart and helpful
`);

const FILLER_TRAILERS = words(`
with many years of experience
with years of experience
with decades of experience
`);

// Politeness / intensifiers deleted wherever they appear.
const DELETE_STD = words(`
please
kindly
very
really
extremely
incredibly
absolutely
totally
literally
truly
actually
basically
essentially
fundamentally
simply
merely
certainly
definitely
indeed
undoubtedly
obviously
of course
in fact
lol
haha
hahaha
umm
um
uh
`);

const DELETE_AGG = words(`
maybe
highly
perhaps
possibly
somewhat
kind of
sort of
a bit
a little bit
a little
fairly
rather
quite
more or less
in a way
to some extent
to a certain degree
i think
i believe
i guess
i feel like
it seems like
it appears that
in my opinion
in my view
personally
as far as i can tell
as far as i know
probably
just
clearly
completely
entirely
naturally
surely
at all
by far
also
you know
i mean
`);

// Sentence-start connectors and transitions.
const CONNECTORS_STD = words(`
in addition
additionally
furthermore
moreover
on top of that
with that said
that being said
having said that
needless to say
it goes without saying
as mentioned
as stated above
as i said before
as noted earlier
as you know
to be clear
to be honest
frankly
honestly
generally speaking
broadly speaking
for the most part
all in all
at the end of the day
when all is said and done
by the way
as a matter of fact
the thing is
the point is
let me explain
what i mean is
to put it simply
simply put
in short
you should know that
keep in mind that
bear in mind that
note that
please note that
it is worth noting that
it is important to note that
it should be noted that
it is worth mentioning that
i would like to point out that
okay so
alright so
so basically
well,
right,
now,
anyway,
i know this is a lot, but
`);

const CONNECTORS_AGG = words(`
the fact that
i have a question
`);

const MAP_STD = pairs(`
in order to -> to
so as to -> to
for the purpose of -> for
with the aim of -> to
with the goal of -> to
with a view to -> to
in an effort to -> to
due to the fact that -> because
owing to the fact that -> because
on account of the fact that -> because
in light of the fact that -> because
given the fact that -> since
despite the fact that -> although
in spite of the fact that -> although
regardless of the fact that -> although
based on the fact that -> because
the reason why is that -> because
the reason for this is -> because
for the reason that -> because
on the grounds that -> because
at this point in time -> now
at the present time -> now
at the present moment -> now
at this moment in time -> now
in the near future -> soon
in the event that -> if
in the case that -> if
in the situation where -> when
on the condition that -> if
provided that -> if
in the absence of -> without
in the presence of -> with
prior to -> before
subsequent to -> after
following on from -> after
at the same time as -> while
during the course of -> during
in the course of -> during
throughout the duration of -> during
for a period of -> for
in a quick manner -> quickly
in a careful manner -> carefully
in a clear manner -> clearly
in an efficient manner -> efficiently
in a detailed way -> in detail
in a concise way -> concisely
in a step-by-step manner -> step by step
on a daily basis -> daily
on a weekly basis -> weekly
on a regular basis -> regularly
on an ongoing basis -> continually
on a case-by-case basis -> case by case
with regard to -> about
with respect to -> about
with reference to -> about
in regard to -> about
in relation to -> about
pertaining to -> about
as it relates to -> about
as regards -> about
vis-a-vis -> about
by means of -> by
by way of -> by
through the use of -> using
making use of -> using
with the help of -> with
in the form of -> as
a large number of -> many
a great deal of -> much
a majority of -> most
the majority of -> most
the vast majority of -> most
the overwhelming majority of -> most
a significant amount of -> much
a number of -> several
a variety of -> various
numerous different -> many
quite a few -> several
each and every -> each
any and all -> all
first and foremost -> first
last but not least -> finally
by and large -> mostly
over and over again -> repeatedly
again and again -> repeatedly
as well as -> and
along with -> with
together with -> with
in addition to -> besides
with the exception of -> except
excluding the case of -> except
in the vicinity of -> near
in close proximity to -> near
in the direction of -> toward
is able to -> can
are able to -> can
has the ability to -> can
have the ability to -> can
has the capability to -> can
is in a position to -> can
is unable to -> cannot
are unable to -> cannot
is not able to -> cannot
are not able to -> cannot
make sure that -> ensure
make sure -> ensure
be sure to -> (delete)
don't forget to -> (delete)
remember to -> (delete)
is going to -> will
are going to -> will
am going to -> will
ought to -> should
is required to -> must
are required to -> must
is supposed to -> should
are supposed to -> should
would like to -> want to
the question of whether -> whether
a question as to whether -> whether
the use of -> using
and so on and so forth -> etc.
and so on -> etc.
and things like that -> etc.
and stuff like that -> etc.
and the like -> etc.
for example -> e.g.
for instance -> e.g.
such as -> like
that is to say -> i.e.
in other words -> i.e.
namely -> i.e.
versus -> vs
whether or not -> whether
until such time as -> until
as soon as possible -> ASAP
at your earliest convenience -> soon
in the meantime -> meanwhile
for the time being -> for now
from time to time -> sometimes
every now and then -> sometimes
once in a while -> sometimes
in most cases -> usually
in the majority of cases -> usually
in many cases -> often
under normal circumstances -> usually
in all cases -> always
at no time -> never
on no occasion -> never
without exception -> always
in every instance -> always
a small number of -> few
a limited number of -> few
a small amount of -> little
a sufficient number of -> enough
adequate amount of -> enough
in excess of -> more than
at a minimum -> at least
at the very least -> at least
at a maximum -> at most
at the very most -> at most
exactly the same -> identical
completely different -> different
totally different -> different
as compared to -> vs
in comparison with -> vs
in comparison to -> vs
as a result of -> because of
as a consequence of -> because of
as a result -> so
consequently -> so
therefore -> so
thus -> so
hence -> so
accordingly -> so
for this reason -> so
because of this -> so
nevertheless -> still
nonetheless -> still
whereas -> while
make a decision -> decide
make a determination -> determine
make an assessment -> assess
make a comparison -> compare
make an attempt -> try
make an improvement -> improve
make a recommendation -> recommend
make a suggestion -> suggest
make a list -> list
make use of -> use
make changes to -> change
give consideration to -> consider
give an explanation of -> explain
give a description of -> describe
give a summary of -> summarize
provide a summary of -> summarize
provide an explanation of -> explain
provide a description of -> describe
provide a list of -> list
provide an analysis of -> analyze
provide feedback on -> critique
provide assistance with -> help with
provide guidance on -> advise on
take into consideration -> consider
take into account -> consider
have a look at -> check
have a discussion about -> discuss
conduct an investigation of -> investigate
conduct an analysis of -> analyze
carry out a review of -> review
perform an analysis of -> analyze
perform a calculation of -> calculate
put emphasis on -> stress
place emphasis on -> stress
come to a conclusion -> conclude
reach a conclusion -> conclude
draw a conclusion -> conclude
arrive at a decision -> decide
express disagreement with -> disagree with
perform an evaluation of -> evaluate
conduct a search for -> search
do a check of -> check
do a comparison between -> compare
do a summary of -> summarize
do some research on -> research
do an analysis on -> analyze
carry out a test of -> test
give a response to -> answer
give an answer to -> answer
provide a response -> reply
provide an answer -> answer
offer a suggestion -> suggest
express an opinion -> say
share your thoughts on -> comment on
give your thoughts on -> comment on
give me feedback on -> critique
give me your feedback -> critique
give me a rating of -> rate
assign a score to -> score
come up with -> create
figure out -> determine
find out -> learn
look into -> investigate
point out -> note
bring up -> raise
write up -> draft
write out -> write
fill out -> complete
sum up -> summarize
wrap up -> finish
carry on -> continue
keep going with -> continue
get rid of -> remove
leave out -> omit
split up -> split
pick out -> select
filter out -> exclude
turn into -> convert to
change into -> convert to
utilize -> use
utilizing -> using
commence -> start
initiate -> start
endeavor -> try
attempt to -> try to
attempt -> try
ascertain -> find out
demonstrate -> show
elucidate -> explain
subsequently -> later
previously -> before
assistance -> help
modification -> change
methodology -> method
optimal -> best
accomplish -> do
purchase -> buy
obtain -> get
require -> need
possess -> have
reside -> live
inquire -> ask
assist -> help
transmit -> send
encompass -> include
expedite -> speed up
finalize -> finish
numerous -> many
whilst -> while
amongst -> among
in accordance with -> per
in line with -> per
in keeping with -> per
with the result that -> so
provide me with -> provide
write me a -> write a
write me an -> write an
i only want -> only
i want you to act as a -> act as a
i want you to act as -> act as
act as if you are -> act as
pretend that you are -> act as
you are going to play the role of -> role:
you will be acting as -> act as
always remember to -> always
never ever under any circumstances -> never
under no circumstances should you -> never
you are not allowed to -> never
you must never -> never
you should never -> never
as an expert in the field of -> as an expert in
give me a summary of -> summarize
give me a list of -> list
come up with a list of -> list
can you give me some ideas for -> ideas for
give me some ideas for -> ideas for
brainstorm some ideas about -> brainstorm
explain to me in simple terms -> explain simply
explain it to me like i'm five -> ELI5
break this down for me -> break this down
help me understand -> explain
take me through the process of -> steps for
tell me about -> describe
fix any grammar issues in -> fix grammar in
make this sound more professional -> formalize
make this shorter -> shorten
make this more concise -> condense
make this longer -> expand
make this more detailed -> elaborate
convert the following into -> convert to
turn this into a -> convert to
present the output in json format -> output JSON
respond only in json -> JSON only
respond with only the answer -> answer only
do not include any explanation -> no explanation
do not add any extra commentary -> no commentary
do not include anything other than -> only
keep your answer short -> be brief
keep your response brief -> be brief
respond in a professional tone -> professional tone
use a friendly and casual tone -> casual tone
think step by step before answering -> think step by step
explain your reasoning -> show reasoning
show your work -> show work
walk through your logic -> show reasoning
double-check your answer -> verify
make sure your answer is correct -> verify
only use the information i gave you -> use provided info only
only use the text above -> use text only
don't make anything up -> no fabrication
ask me questions if you need more info -> ask if unclear
ask clarifying questions first -> clarify first
wait for my next message -> wait
would it be possible for you to -> can you
do you think you could -> can you
do not use any external libraries -> no external libs
do not use any built-in functions -> no built-ins
make sure the code handles edge cases -> handle edge cases
make the code easy to read -> readable code
add error handling -> handle errors
return only the code -> code only
do not explain the code -> no explanation
include comments in the code -> comment code
find the bug in the following code -> find bug
add comments to this code -> comment code
explain what this code does -> explain code
refactor this code to be cleaner -> refactor
optimize this code for performance -> optimize
write unit tests for this function -> unit tests for
clear and concise -> concise
short and brief -> brief
brief and to the point -> brief
simple and easy -> simple
simple and straightforward -> simple
quick and fast -> fast
clear and understandable -> clear
accurate and correct -> accurate
true and accurate -> accurate
full and complete -> complete
complete and thorough -> thorough
detailed and in-depth -> detailed
comprehensive and exhaustive -> comprehensive
all of the -> all
both of the -> both
whole entire -> whole
end result -> result
final outcome -> outcome
final result -> result
past history -> history
future plans -> plans
advance planning -> planning
advance warning -> warning
added bonus -> bonus
free gift -> gift
unexpected surprise -> surprise
basic fundamentals -> fundamentals
basic essentials -> essentials
close proximity -> proximity
exact same -> same
very unique -> unique
completely unique -> unique
join together -> join
merge together -> merge
combine together -> combine
connect together -> connect
mix together -> mix
repeat again -> repeat
return back -> return
revert back -> revert
rewrite again -> rewrite
reply back -> reply
refer back to -> refer to
continue on -> continue
proceed forward -> proceed
progress forward -> progress
move forward -> proceed
rise up -> rise
fall down -> fall
sum total -> total
overall summary -> summary
general consensus -> consensus
general overview -> overview
personal opinion -> opinion
personal experience -> experience
my own personal -> my
actual fact -> fact
true fact -> fact
real fact -> fact
new innovation -> innovation
new invention -> invention
new update -> update
current status -> status
current trend -> trend
present situation -> situation
ongoing process -> process
in written form -> written
in text form -> as text
in list form -> as a list
in table form -> as a table
in bullet-point form -> as bullets
in paragraph form -> as paragraphs
in json format -> as JSON
in a json format -> as JSON
in csv format -> as CSV
first of all -> first
to begin with -> first
to start off with -> first
in the end -> finally
in conclusion -> finally
to conclude -> finally
as a final point -> finally
as a last step -> finally
in the final analysis -> finally
united states -> US
united kingdom -> UK
artificial intelligence -> AI
machine learning -> ML
large language model -> LLM
natural language processing -> NLP
application programming interface -> API
user interface -> UI
user experience -> UX
frequently asked questions -> FAQ
for your information -> FYI
estimated time of arrival -> ETA
to be determined -> TBD
not applicable -> N/A
et cetera -> etc.
greater than or equal to -> >=
less than or equal to -> <=
not equal to -> !=
`);

const MAP_AGG = pairs(`
in a timely manner -> quickly
when it comes to -> for
in terms of -> for
a wide range of -> many
apart from -> besides
aside from -> besides
the issue of -> (delete)
the topic of -> (delete)
the subject of -> (delete)
the concept of -> (delete)
the idea of -> (delete)
the process of -> (delete)
the act of -> (delete)
the notion of -> (delete)
the area of -> (delete)
the field of -> (delete)
in the process of -> (delete)
has to -> must
have to -> must
need to -> must
try to -> (delete)
find a way to -> (delete)
sufficient -> enough
in no case -> never
work out -> solve
objective -> goal
brief summary -> summary
short summary -> summary
quick summary -> summary
brief overview -> overview
latest update -> update
current state -> state
step-by-step process -> steps
step-by-step guide -> guide
total number of -> total
look at -> review
take a look at -> review
check out -> review
go over -> review
go through -> review
take out -> remove
take away -> remove
cut out -> remove
put in -> add
put together -> assemble
set up -> configure
switch to -> use
pull out -> extract
call out -> flag
walk me through -> steps for
tell me everything about -> overview of
check this for errors -> proofread
find any mistakes in -> proofread
at first -> first
in the beginning -> first
give an overview of -> summarize
according to -> per
on the basis of -> by
upon -> on
leverage -> use
facilitate -> help
terminate -> end
indicate -> show
illustrate -> show
clarify -> explain
initially -> first
ultimately -> finally
eventually -> finally
immediately -> now
requirement -> need
alternative -> option
functionality -> features
implementation -> build
maximum -> max
minimum -> min
retain -> keep
reveal -> show
locate -> find
construct -> build
append -> add
incorporate -> add
exhibit -> show
formulate -> write
tons of -> many
a bunch of -> several
extremely important -> critical
very very important -> critical
really important -> key
of utmost importance -> critical
of great importance -> important
very important -> vital
very big -> huge
very small -> tiny
very good -> excellent
very bad -> terrible
very fast -> rapid
very slow -> sluggish
very old -> ancient
very happy -> elated
very sad -> miserable
very tired -> exhausted
very clear -> obvious
very difficult -> hard
very easy -> trivial
very short -> brief
very long -> lengthy
very detailed -> thorough
very simple -> basic
very complex -> intricate
very large -> huge
very strong -> robust
very weak -> frail
very common -> ubiquitous
very rare -> scarce
very useful -> valuable
very careful -> meticulous
very afraid -> terrified
not very good -> poor
not very big -> small
not very important -> minor
not many -> few
not much -> little
not often -> rarely
not the same -> different
does not have -> lacks
did not succeed -> failed
comprehensive and detailed -> detailed
engaging and compelling -> engaging
professional and polished -> professional
creative and innovative -> creative
unique and original -> original
informative and educational -> informative
well-structured and organized -> organized
in-depth and thorough -> thorough
easy-to-read and easy-to-understand -> clear
actionable and practical -> practical
thoughtful and insightful -> insightful
accurate and reliable -> accurate
in my opinion -> IMO
january -> Jan
february -> Feb
august -> Aug
september -> Sep
october -> Oct
november -> Nov
december -> Dec
monday -> Mon
tuesday -> Tue
wednesday -> Wed
thursday -> Thu
friday -> Fri
saturday -> Sat
sunday -> Sun
`);

// Only at the start of a sentence (mid-sentence use of these changes grammar).
const MAP_START_AGG = pairs(`
however -> but
on the other hand -> but
in contrast -> but
conversely -> but
`);

const NUM_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const UNIT_ABBR = { seconds: 'sec', second: 'sec', minutes: 'min', minute: 'min', hours: 'hr', hour: 'hr', milliseconds: 'ms', megabytes: 'MB', gigabytes: 'GB' };

// ---------------------------------------------------------------- assembly

const BUILD = [
  // 1. Labels and whole-sentence chatter
  labels('standard', LABELS_STD),
  labels('aggressive', LABELS_AGG),
  delSentence('standard', CHATTER),
  delSentence('aggressive', CHATTER_AGG),
  // 2. Politeness and openers (leave an imperative)
  rule('standard', /^(?:(?:hi|hello|hey)\s+there\b[,!.]?|(?:hi|hello|hey)[,!.])\s*/i, ''),
  rule('standard', /^dear (?:claude|assistant|chatgpt|gemini)\b[,:]?\s*/i, ''),
  del('standard', ['please', 'kindly']),
  delStart('standard', OPENERS, { afterComma: true }),
  delStart('aggressive', OPENERS_AGG),
  rule('standard', new RegExp(`${SS}(?:could|can|would|will) you (?:please |kindly )?help me (?:to )?(?!with\\b|out\\b)(\\S)`, 'gi'),
    (m, pre, next) => pre + (isUpper(m.slice(pre.length)) ? next.toUpperCase() : next)),
  rule('standard', new RegExp(`${SS}(?:could|can|would|will) you (?:please |kindly )?(\\S)`, 'gi'),
    (m, pre, next) => pre + (isUpper(m.slice(pre.length)) ? next.toUpperCase() : next)),
  // 3. Wordy phrases -> short
  rule('standard', new RegExp(`(?:\\b(a|an)\\s+)?\\b(?:${alt(PERSONA_ADJ)})\\s+(?=(\\S+))`, 'gi'),
    (m, art, next) => (art ? `${articleOnly(art, next)} ` : '')),
  del('standard', FILLER_TRAILERS),
  map('standard', MAP_STD),
  map('aggressive', MAP_AGG),
  mapStart('aggressive', MAP_START_AGG),
  rule('standard', /\band\s*\/\s*or\b/gi, 'or'),
  rule('standard', /(\d)\s*(?:percent|per cent)\b/gi, '$1%'),
  rule('standard', /(\d)\s+%/g, '$1%'),
  rule('standard', /\b(\d[\d,]*(?:\.\d+)?)\s+dollars\b/gi, (m, n) => `$${n}`),
  rule('standard', /\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+(hundred|thousand)\b/gi,
    (m, n, u) => String(NUM_WORDS[n.toLowerCase()]) + (u.toLowerCase() === 'hundred' ? '00' : '000')),
  rule('standard', /\bbetween\s+(\d+)\s+and\s+(\d+)\b/gi, '$1-$2'),
  rule('standard', /\bfrom\s+(\d+)\s+to\s+(\d+)\b/gi, '$1-$2'),
  rule('standard', /\b(?:approximately|roughly|around)\s+(?=\d)/gi, '~'),
  rule('standard', /\bapproximately\b/gi, (m) => (isUpper(m) ? 'About' : 'about')),
  rule('aggressive', /\babout\s+(?=\d)/gi, '~'),
  rule('aggressive', /(\d)\s*(seconds?|minutes?|hours?|milliseconds|megabytes|gigabytes)\b/gi,
    (m, n, u) => `${n} ${UNIT_ABBR[u.toLowerCase()]}`),
  rule('aggressive', /(\d)\s*(?:kilometers|kilometres) per hour\b/gi, '$1 km/h'),
  rule('aggressive', /(\d)\s*miles per hour\b/gi, '$1 mph'),
  rule('aggressive', /(\d)\s*square feet\b/gi, '$1 sq ft'),
  rule('standard',
    new RegExp(`\\b(?:in )?(?:limit your (?:answer|response) to|your (?:answer|response) should not exceed|(?:use )?no more than)\\s+(\\d+)\\s+(words|sentences|bullets|bullet points|paragraphs|lines)\\b`, 'gi'),
    (m, n, unit) => `max ${n} ${unit.toLowerCase() === 'bullet points' ? 'bullets' : unit.toLowerCase()}`),
  rule('standard',
    /\btranslate the following (?:text )?(?:in)?to (\w+)\s*:?\s*/gi, 'translate to $1: '),
  rule('standard',
    /\bin the (English|Spanish|French|German|Italian|Portuguese|Chinese|Japanese|Korean|Russian|Arabic|Hindi) language\b/gi, 'in $1'),
  rule('standard', /\b(?:the )?([A-Z][\w+#.]*) programming language\b/g, '$1'),
  // 4. Fillers, intensifiers, connectors
  delStart('standard', CONNECTORS_STD),
  delStart('aggressive', CONNECTORS_AGG),
  del('standard', DELETE_STD),
  del('aggressive', DELETE_AGG),
  rule('standard', /,\s*(?:right|okay|ok)\?/gi, ''),
  // Trailing softeners only, so "if you could" inside a longer opener is left to the opener rule.
  rule('aggressive', /(?<=\w),?\s+if (?:you could|possible|you don['’]t mind)(?=\s*[.!?]|$)/gi, ''),
  delStart('aggressive', ['if possible,', 'if you could,', "if you don't mind,"]),
  // 5. Formatting
  rule('standard', /^Question\s*:/, 'Q:'),
  rule('standard', /^Answer\s*:/, 'A:'),
  rule('standard', /\*\*([^*\n]+)\*\*/g, '$1'),
  rule('standard', /__([^_\n]+)__/g, '$1'),
  rule('standard', /([!?])\1+/g, '$1'),
  rule('standard', /\.{4,}/g, '...'),
  rule('aggressive', /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]/gu, ''),
];

const cache = {};
export function getRules(level = 'standard') {
  cache[level] ??= BUILD.filter((r) => level === 'aggressive' || r.level === 'standard');
  return cache[level];
}

// Lines that are only decorative separators (=====, -----, *****).
export const isSeparatorLine = (line) => /^\s*([=*_#~-])\1{2,}\s*$/.test(line);
