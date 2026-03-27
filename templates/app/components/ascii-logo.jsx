import brand from '../../../config/brand.json' assert { type: 'json' };

export function AsciiLogo() {
  return (
    <pre className="text-foreground text-[clamp(0.45rem,1.5vw,0.85rem)] leading-snug text-left mb-8 select-none">{`  _____ _             ____        _
 / ____(_)           |  _ \\      | |
| |  __ _  __ _  __ _| |_) | ___ | |_
| | |_ | |/ _\` |/ _\` |  _ < / _ \\| __|
| |__| | | (_| | (_| | |_) | (_) | |_
 \\_____|_|\\__, |\\__,_|____/ \\___/ \\__|
           __/ |
          |___/   Powered by ${brand.company}`}</pre>
  );
}
