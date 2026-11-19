import type {Metadata} from 'next';
import './globals.css';
import './sweet-echo.css';
import './hearing-visuals.css';
export const metadata:Metadata={title:'Echo — Find your frequency',icons:{icon:[{url:'/echo-tab.svg?v=4',type:'image/svg+xml'},{url:'/favicon.ico?v=3',sizes:'any'}],apple:'/echo-tab.png'},description:'A little play. A closer look at your hearing. Explore Echo’s interactive hearing-health showcase.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
