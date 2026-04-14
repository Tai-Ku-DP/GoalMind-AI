import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-950 dark:to-gray-900">
      <div className="max-w-2xl px-6 text-center">
        <div className="mb-8 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-4xl text-white shadow-lg">
          🎯
        </div>

        <h1 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
          GoalMind AI
        </h1>
        <p className="mb-8 text-lg text-gray-600 dark:text-gray-400">
          Trợ lý quản trị doanh nghiệp thông minh, kết nối trực tiếp với
          Simplamo. Hỏi về mục tiêu, chỉ số, và công việc bằng tiếng Việt tự
          nhiên.
        </p>

        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-8 py-3.5 text-lg font-semibold text-white shadow-md transition hover:opacity-90"
          >
            Bắt đầu chat
            <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-left dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-3 text-2xl">🎯</div>
            <h3 className="mb-1 font-semibold text-gray-900 dark:text-white">
              Goals &amp; OKR
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Theo dõi tiến độ Rock, OKR và nhận cảnh báo khi off-track
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-left dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-3 text-2xl">📊</div>
            <h3 className="mb-1 font-semibold text-gray-900 dark:text-white">
              Metrics &amp; KPI
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Phân tích scorecard, xu hướng chỉ số và phát hiện vấn đề
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-left dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-3 text-2xl">✅</div>
            <h3 className="mb-1 font-semibold text-gray-900 dark:text-white">
              Actions &amp; Todo
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Quản lý việc cần làm, tạo action và cập nhật trạng thái
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
