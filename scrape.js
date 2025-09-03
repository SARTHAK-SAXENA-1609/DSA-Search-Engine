import puppeteer from "puppeteer";
import fsPromises from "fs/promises";

async function scrapLeetcodeProblems () {
    const browser = await puppeteer.launch({
        headless: true,
        defaultViewport: null,
        args: ["--disable-blink-features=AutomationControlled"],
        // ignoreHTTPSErrors: true,
    });
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36");


    await page.goto("https://leetcode.com/problemset/" , {
        waitUntil: "domcontentloaded",
    });

    const problemSelector =
    "a.group.flex.flex-col.rounded-\\[8px\\].duration-300";

    let allProblems = [];
    let prevCount =0;
    const TARGET = 500;

    while(allProblems.length < TARGET){
        await page.evaluate( (sel) => {
            const currProblemsOnPage = document.querySelectorAll(sel);
            if(currProblemsOnPage.length ) {
                currProblemsOnPage[currProblemsOnPage.length - 1].scrollIntoView({
                    behavior: "smooth",
                    block: "end",
                });
            } 
        } , problemSelector);
        await page.waitForFunction(
            (sel , prev) => document.querySelectorAll(sel).length > prev,
            {},
            problemSelector,
            prevCount     
        );
        allProblems = await page.evaluate( (sel)=>{
            const nodes = Array.from(document.querySelectorAll(sel));
            return nodes.map( (ele) => ({
                title :  ele.querySelector(".ellipsis.line-clamp-1")?.textContent.trim().split(". ")[1],
                url : ele.href,
            }))
        } , problemSelector);

        prevCount = allProblems.length;
    }
    console.log(allProblems);

    let problemsWithDescriptions = [];
    for(let i = 0 ; i < TARGET ; i++){
        const {title , url} = allProblems[i];
        const problemPage = await browser.newPage();
        try{
            await problemPage.goto(url);
            let description = await problemPage.evaluate(() => {
                    const descriptionDiv = document.querySelector(
            'div.elfjS[data-track-load="description_content"]'
            );

            const paragraphs = descriptionDiv.querySelectorAll("p");

            let collectedDescription = [];
            for (const p of paragraphs) {
                if (p.innerHTML.trim() === "&nbsp;") {
                    break;
                }
                collectedDescription.push(p.innerText.trim());
            }

            return collectedDescription.filter((text) => text !== "").join(" ");

            });
            problemsWithDescriptions.push({ title, url, description });
        }
        catch (error){
            console.error(`Error fetching description for ${title} (${url}):`, err);
        } finally {
            await problemPage.close();
        }
    }
    // recursive true means if there isalready an dir then dont throw an error
    await fsPromises.mkdir("./problems", { recursive: true });

    await fsPromises.writeFile(
        "./problems/leetcode_problems.json",
        JSON.stringify(problemsWithDescriptions, null, 2)
    );

    await browser.close();
};

scrapLeetcodeProblems();