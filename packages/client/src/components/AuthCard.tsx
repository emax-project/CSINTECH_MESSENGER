import type { ReactNode } from 'react';
import { cn } from '../utils/cn';

const LOGO_SRC = `${import.meta.env.BASE_URL}csin-logo.png`;

type Props = {
  children: ReactNode;
  title: string;
  subtext?: ReactNode;
  className?: string;
};

export function AuthCard({ children, title, subtext, className }: Props) {
  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-[24px] w-full max-w-full shadow-2xl bg-white',
        className,
      )}
    >
      <div className="flex flex-col justify-center px-6 py-10 sm:px-8">
        <div className="flex flex-col items-center text-center mb-8">
          <img src={LOGO_SRC} alt="CSIN Tech" className="mb-5 h-10 w-auto max-w-[240px] object-contain" />
          <h1 className="brand-title text-xl font-bold text-black">{title}</h1>
          {subtext ? <p className="mt-2 text-sm text-[#64748b]">{subtext}</p> : null}
        </div>
        {children}
      </div>
    </div>
  );
}
