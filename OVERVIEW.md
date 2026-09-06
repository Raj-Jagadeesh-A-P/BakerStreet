# bakerstreet — detailed overview

## the basic idea

a detective game
not one mystery but many cases
one case at a time
you chase clues on real open source repos on github
solve every sub-file of a case
close the case with a final answer
get points
go to the next case

## who you are

you join an event as a team (2-3 people)
your team are the investigators -> the detectives, the solvers
the cases don't belong to you
they are handed to you one by one by three kinds of clients
- a Private Client
- Scotland Yard
- Mycroft Holmes

just like sherlock -> someone walks in with a mystery, you work it
you solve it, you get the credit, next case comes

at sign-up you pick one of those three as your client
it's who you work for -> a theme badge only, no power
just flavor, not ability

## the flow

admin creates an event
admin builds all the cases in advance

each event has many cases
each case has sub-files (the actual puzzles)
sub-files are ordered -> you solve them one by one, no skipping

admin starts the event -> participants can play
admin starts/unlocks case 1 -> opens for everyone
teams work on the sub-files

sub-file = a question on a real repo
- a github link to investigate
- a story
- a question
- optional hints (cost points)
- evidence you collect along the way

submit the answer
correct -> +points, next sub-file unlocks
wrong -> small penalty, try again (attempt limits possible)
hints -> each hint costs points off your score

when all sub-files of a case are solved
-> the closing challenge is released
the closing = a final answer for the whole case
first team to close it right -> 1st place bonus
next -> 2nd bonus
next -> 3rd bonus
everyone else who closes -> small/no bonus

admin closes the case, starts the next one
and so on, case after case

winners are decided acc -> most total points when the event ends

## why ranking is fair

bonus only for the first 3 closing teams
so speed matters, but every sub-file's points still matter
your final standing = your whole investigation work, not one lucky finish

## the leaderboard

live ranking of all teams
shows score, sub-files solved, cases closed
each case shows who closed it and in what rank

## the event lifecycle

draft -> admin builds and previews
live -> teams join, play, close cases
paused -> stop submissions, keep viewing
ended -> no more submissions, final standings

## who controls what

admin panel:
- create/manage events
- build cases + sub-files (answers, hints, evidence, points, penalties, attempt limits)
- start/pause/end the event
- unlock and close cases one by one
- watch submissions, closings, participants, teams
- export everything as csv (participants, teams, scores, submissions, closings)

## how it's built

browser client (React) + api server (Node) + firebase (Auth + Firestore)
participant view -> dashboard, case sub-files, hints, evidence, closing, leaderboard
admin view -> a separate panel
real firebase project runs the live game
demo data is seeded in, tests run against local emulators