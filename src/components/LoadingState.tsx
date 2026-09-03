import { Skeleton } from 'antd';

export default function LoadingState({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-3.5">
          <Skeleton active title={{ width: '70%' }} paragraph={{ rows: 2, width: ['90%', '55%'] }} />
          <div className="mt-3 flex gap-2">
            <Skeleton.Button active block size="small" />
            <Skeleton.Button active block size="small" />
          </div>
        </div>
      ))}
    </div>
  );
}
