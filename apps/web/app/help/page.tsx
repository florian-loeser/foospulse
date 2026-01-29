'use client'

import { useState } from 'react'
import Link from 'next/link'

type FAQItem = {
  question: string
  answer: string
}

const faqs: FAQItem[] = [
  {
    question: "What is FoosPulse?",
    answer: "FoosPulse is a foosball league management app that helps you track matches, player statistics, and rankings. It's perfect for office leagues, clubs, or friend groups who want to keep track of their foosball games."
  },
  {
    question: "Is FoosPulse free to use?",
    answer: "Yes! FoosPulse is completely free to use. You can create leagues, add players, log matches, and view statistics without any cost."
  },
  {
    question: "How do I create a league?",
    answer: "After signing in, click 'Create League' on the leagues page. Give your league a name, choose a unique URL slug, set your timezone, and decide if it should be public or private. A default season will be created automatically."
  },
  {
    question: "What's the difference between 1v1 and 2v2 matches?",
    answer: "In 1v1 matches, two players compete against each other. In 2v2 matches, teams of two players each compete, with one player in attack position and one in defense position."
  },
  {
    question: "What is a 'gamelle'?",
    answer: "A gamelle (also known as an 'own goal' or 'five-hole') is when the ball goes through the gap between a player rod's figures. It's tracked separately in FoosPulse and appears on the 'Wall of Shame' leaderboard."
  },
  {
    question: "What is a 'lob'?",
    answer: "A lob is a special type of gamelle where the ball goes over the rod and through the gap. In FoosPulse, a lob counts as 3 gamelles."
  },
  {
    question: "How does the rating system work?",
    answer: "FoosPulse uses an Elo rating system (similar to chess). All players start at 1200 points. When you win, you gain points; when you lose, you lose points. The amount depends on the rating difference between players - beating a higher-rated player gives more points."
  },
  {
    question: "Can I invite others to my league?",
    answer: "Yes! Go to your league settings and find the invite link. Share this link with anyone you want to join. They'll need to create an account if they don't have one."
  },
  {
    question: "What happens if I log a match incorrectly?",
    answer: "League admins can void matches. Go to the match details and click 'Void Match'. Voided matches don't count toward statistics or ratings."
  },
  {
    question: "Can I have multiple seasons?",
    answer: "Yes! When you're ready to start fresh, create a new season from the league settings. The previous season will be archived, and all stats will reset for the new season."
  },
  {
    question: "What are guest players?",
    answer: "Guest players are players without accounts. They're useful for tracking matches with people who don't want to sign up. Guest players can be converted to full players later if they create an account."
  },
  {
    question: "Can I export my data?",
    answer: "Yes! You can generate league reports from the Artifacts page. These reports include all match history and statistics."
  }
]

function FAQAccordion({ item, isOpen, onToggle }: { item: FAQItem, isOpen: boolean, onToggle: () => void }) {
  return (
    <div className="border-b border-gray-200 dark:border-gray-700">
      <button
        onClick={onToggle}
        className="w-full py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <span className="font-medium text-gray-900 dark:text-white pr-4">{item.question}</span>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="pb-4 text-gray-600 dark:text-gray-400">
          {item.answer}
        </div>
      )}
    </div>
  )
}

export default function HelpPage() {
  const [openFAQ, setOpenFAQ] = useState<number | null>(0)

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <span className="font-bold text-xl text-gray-900 dark:text-white">FoosPulse</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/auth/register"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Help & Documentation</h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">Everything you need to know about FoosPulse</p>
        </div>

        {/* Quick Start Guide */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
            <span className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </span>
            Quick Start Guide
          </h2>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">1</div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Create an Account</h3>
                <p className="text-gray-600 dark:text-gray-400">Sign up with your email address and create a password. It only takes a few seconds.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">2</div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Create or Join a League</h3>
                <p className="text-gray-600 dark:text-gray-400">Start your own league or join an existing one using an invite link from a friend.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">3</div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Add Players</h3>
                <p className="text-gray-600 dark:text-gray-400">Invite league members or create guest players for people who don't want to make an account.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">4</div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Log Matches</h3>
                <p className="text-gray-600 dark:text-gray-400">Record your games with scores, player positions, and special events like gamelles.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">5</div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Track Stats & Rankings</h3>
                <p className="text-gray-600 dark:text-gray-400">Watch the leaderboards update automatically. See who's the best attacker, defender, and more!</p>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
            <span className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </span>
            Features
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Match Logging</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Record 1v1 and 2v2 matches with detailed player positions, scores, and special events.</p>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Elo Ratings</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Automatic skill-based ratings that update after every match, just like chess rankings.</p>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Leaderboards</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Multiple ranking categories: overall, attack, defense, win streaks, and the infamous Wall of Shame.</p>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Player Statistics</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Detailed stats for each player including win rates, preferred positions, best partners, and nemeses.</p>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Seasons</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Organize your league into seasons. Archive old seasons and start fresh while keeping historical data.</p>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Live Match Mode</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Real-time match tracking with shareable spectator links. Perfect for tournaments!</p>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Team Synergy</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Discover which player combinations work best together with synergy statistics.</p>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Reports & Export</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Generate comprehensive league reports and export your data anytime.</p>
            </div>
          </div>
        </section>

        {/* Glossary */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
            <span className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </span>
            Glossary
          </h2>

          <div className="space-y-4">
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <dt className="font-semibold text-gray-900 dark:text-white">Attack Position</dt>
              <dd className="text-gray-600 dark:text-gray-400 mt-1">The player controlling the 3-rod (midfield) and 5-rod (attack) in 2v2 games. Primarily responsible for scoring goals.</dd>
            </div>

            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <dt className="font-semibold text-gray-900 dark:text-white">Defense Position</dt>
              <dd className="text-gray-600 dark:text-gray-400 mt-1">The player controlling the goalie rod and 2-rod (defense) in 2v2 games. Primarily responsible for preventing goals.</dd>
            </div>

            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <dt className="font-semibold text-gray-900 dark:text-white">Gamelle</dt>
              <dd className="text-gray-600 dark:text-gray-400 mt-1">When the ball passes through the gap between figures on a rod (also called "five-hole" or "nutmeg"). A moment of shame!</dd>
            </div>

            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <dt className="font-semibold text-gray-900 dark:text-white">Lob</dt>
              <dd className="text-gray-600 dark:text-gray-400 mt-1">A gamelle where the ball goes over the rod before passing through. Extra shameful - counts as 3 regular gamelles!</dd>
            </div>

            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <dt className="font-semibold text-gray-900 dark:text-white">Elo Rating</dt>
              <dd className="text-gray-600 dark:text-gray-400 mt-1">A numerical skill rating (starting at 1200) that goes up when you win and down when you lose. The amount depends on your opponent's rating.</dd>
            </div>

            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <dt className="font-semibold text-gray-900 dark:text-white">Wall of Shame</dt>
              <dd className="text-gray-600 dark:text-gray-400 mt-1">The leaderboard showing who has received the most gamelles. A badge of... distinction.</dd>
            </div>

            <div className="pb-4">
              <dt className="font-semibold text-gray-900 dark:text-white">Void Match</dt>
              <dd className="text-gray-600 dark:text-gray-400 mt-1">A match that has been canceled and doesn't count toward statistics. Used when a match was logged incorrectly.</dd>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
            <span className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            Frequently Asked Questions
          </h2>

          <div>
            {faqs.map((faq, index) => (
              <FAQAccordion
                key={index}
                item={faq}
                isOpen={openFAQ === index}
                onToggle={() => setOpenFAQ(openFAQ === index ? null : index)}
              />
            ))}
          </div>
        </section>

        {/* Contact */}
        <section className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-8 text-center text-white">
          <h2 className="text-2xl font-bold mb-4">Still have questions?</h2>
          <p className="mb-6 text-green-100">We're here to help! Reach out if you need assistance.</p>
          <a
            href="https://github.com/florian-loeser/foospulse/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-green-600 font-semibold rounded-xl hover:bg-green-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
            Open an Issue on GitHub
          </a>
        </section>

        {/* Footer */}
        <footer className="mt-12 text-center text-gray-500 dark:text-gray-400 text-sm">
          <p>&copy; 2026 FoosPulse. Made with passion for foosball.</p>
        </footer>
      </div>
    </main>
  )
}
