'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Images, ShieldCheck, Sparkles, WifiOff } from 'lucide-react';
import type { WorkflowConfig } from '@/utils/workflows';
import { VERSION_TICKER } from '@/utils/versionTicker';

interface HomePageProps {
    onSelectPhotos: () => void;
    workflow: WorkflowConfig;
}

const benefits = [
    { icon: ShieldCheck, label: 'Private by design', detail: 'Photos stay on this device' },
    { icon: WifiOff, label: 'Works offline', detail: 'No connection required' },
    { icon: Sparkles, label: 'Ready in seconds', detail: 'No account or setup' },
];

export default function HomePage({ onSelectPhotos, workflow }: HomePageProps) {
    return (
        <main className="relative min-h-dvh overflow-hidden bg-[#f7f8fb] text-slate-950">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.10),transparent_42%)]" />

            <div className="relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 py-5 sm:px-8 sm:py-7">
                <header className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 text-sm font-semibold tracking-tight text-slate-800">
                        <Image src="/icon-rounded.svg" alt="" width={32} height={32} priority />
                        <span>
                            Photo Grouper
                            <span
                                className="block font-mono text-[10px] font-normal tracking-normal text-slate-400 select-none"
                                title="Version · build · commit"
                            >
                                {VERSION_TICKER}
                            </span>
                        </span>
                    </div>
                    <Link
                        href="/privacy"
                        className="rounded-full px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    >
                        Privacy
                    </Link>
                </header>

                <section className="flex flex-1 items-center py-10 sm:py-14">
                    <div className="mx-auto grid w-full items-center gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:gap-20">
                        <div className="max-w-xl text-center lg:text-left">
                            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/80 px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm shadow-indigo-100/60">
                                <ShieldCheck className="h-3.5 w-3.5" />
                                {workflow.eyebrow}
                            </div>
                            <h1 className="text-balance text-5xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-6xl lg:text-7xl">
                                {workflow.title}
                            </h1>
                            <p className="mx-auto mt-6 max-w-lg text-pretty text-lg leading-8 text-slate-600 lg:mx-0">
                                {workflow.description}
                            </p>
                            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
                                <button
                                    onClick={onSelectPhotos}
                                    className="group inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-slate-950 px-7 text-base font-semibold text-white shadow-xl shadow-slate-950/15 transition hover:-translate-y-0.5 hover:bg-indigo-600 hover:shadow-indigo-600/20 sm:w-auto"
                                >
                                    <Images className="h-5 w-5" />
                                    Browse photo library
                                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                                </button>
                                <span className="text-sm text-slate-400">Free to create · No watermark</span>
                            </div>
                        </div>

                        <div className="relative mx-auto w-full max-w-[520px]" aria-hidden="true">
                            <div className="absolute -inset-10 rounded-full bg-indigo-200/30 blur-3xl" />
                            <div className="relative grid aspect-[1.08] grid-cols-2 grid-rows-2 gap-3 rounded-[2rem] border border-white/80 bg-white/75 p-4 shadow-[0_32px_80px_-32px_rgba(30,41,59,0.35)] backdrop-blur-xl sm:gap-4 sm:p-5">
                                <div className="row-span-2 overflow-hidden rounded-[1.35rem] bg-gradient-to-br from-indigo-500 to-indigo-700 p-5 text-white shadow-inner">
                                    <div className="flex h-full flex-col justify-between">
                                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-100">Main moment</span>
                                        <div>
                                            <div className="mb-3 h-12 w-12 rounded-full bg-white/15" />
                                            <p className="text-2xl font-semibold tracking-tight">Together looks better.</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="rounded-[1.35rem] bg-gradient-to-br from-amber-200 to-orange-400" />
                                <div className="rounded-[1.35rem] bg-gradient-to-br from-violet-200 to-fuchsia-400" />
                            </div>
                        </div>
                    </div>
                </section>

                <div className="grid gap-3 border-t border-slate-200/80 pt-5 sm:grid-cols-3">
                    {benefits.map(({ icon: Icon, label, detail }) => (
                        <div key={label} className="flex items-center gap-3 rounded-2xl px-2 py-2">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/70">
                                <Icon className="h-4 w-4" />
                            </span>
                            <span>
                                <span className="block text-sm font-semibold text-slate-800">{label}</span>
                                <span className="block text-xs text-slate-500">{detail}</span>
                            </span>
                        </div>
                    ))}
                </div>

                <footer className="mt-4 border-t border-slate-200/80 pt-3 text-center font-mono text-[10px] text-slate-400 select-none">
                    {VERSION_TICKER}
                </footer>
            </div>
        </main>
    );
}
