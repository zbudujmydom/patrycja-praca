import React, { ChangeEvent, useState } from 'react';
import './App.css';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.js';
import { PDFDocument, rgb, degrees } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { CSVToArray } from './utils/csvParser';
import { getFormatterTranslationsArray } from './utils/getFormattedTranslationsArray';
import { TextItem } from 'pdfjs-dist/types/src/display/api';

GlobalWorkerOptions.workerSrc = require('pdfjs-dist/build/pdf.worker.entry.js');

function App() {
    const [translations, setTranslations] = useState<{
        [key: string]: string;
    } | null>(null);
    const [checkedAllPages, setCheckedAllPages] = useState<boolean>(false);
    const [totalPdfPages, setTotalPdfPages] = useState<number>();
    const [dataToUseOnPDfWithTypeA, setDataToUseOnPDfWithTypeA] = useState<{ [page: string]: string }>();
    const [dataToUseOnPDfWithTypeB, setDataToUseOnPDfWithTypeB] = useState<{ [page: string]: { x: number; y: number; str: string }[] }>();
    const [pdfToEdit, setPdfToEdit] = useState<PDFDocument>();
    const [showPdfSpinner, setShowPdfSpinner] = useState<boolean>(false);
    const [showCsvFileError, setShowCsvFileError] = useState<boolean>(false);
    const [showPdfFileError, setShowPdfFileError] = useState<boolean>(false);
    const [labelType, setLabelType] = useState<'A' | 'B' | null>(null);
    const [carNumber, setCarNumber] = useState('');

    const [allRefExpeditions, setAllRefExpeditions] = useState<string[]>([]);
    const [allRefArticles, setAllRefArticles] = useState<string[]>([]);

    async function pdfInputChange(e: ChangeEvent<HTMLInputElement>) {
        if (!translations || !labelType) {
            return;
        }

        if (!e.target.files || e.target.files[0].type != 'application/pdf') {
            setShowPdfFileError(true);
            return;
        }

        setShowPdfFileError(false);
        setShowPdfSpinner(true);

        const file = e.target.files[0];
        const fileReader = new FileReader();

        fileReader.onload = async function () {
            const typedarray = new Uint8Array(fileReader.result as any);

            getDocument({ data: typedarray })
                .promise.then((pdf) => {
                    const pages = pdf.numPages;
                    setTotalPdfPages(pages);
                    const allPromises = [];
                    for (let i = 1; i <= pages; i++) {
                        allPromises.push(pdf.getPage(i));
                    }

                    Promise.all(allPromises).then((allPages) => {
                        const allPagesTextContents = [];
                        for (let j = 0; j < allPages.length; j++) {
                            allPagesTextContents.push(allPages[j].getTextContent());
                        }

                        Promise.all(allPagesTextContents).then((allTextContents) => {
                            if (labelType === 'A') {
                                const result: { [page: string]: string } = {};

                                const refExpeditions: string[] = [];
                                const refArticles: string[] = [];

                                // console.log(allTextContents); // show all data from PDF

                                allTextContents.forEach((textContent, index) => {
                                    textContent.items.forEach((item, itemIndex, allItems) => {
                                        const str = (item as TextItem).str;
                                        if (translations![str] !== undefined) {
                                            result[index] = translations![str];
                                        }

                                        if (str.includes('Réf expédition')) {
                                            refExpeditions.push((allItems[itemIndex + 2] as TextItem).str);
                                        }

                                        if (str.includes('Réf article')) {
                                            refArticles.push((allItems[itemIndex + 2] as TextItem).str);
                                        }
                                    });
                                    setDataToUseOnPDfWithTypeA(result);
                                    setCheckedAllPages(true);
                                });
                                setAllRefExpeditions(refExpeditions);
                                setAllRefArticles(refArticles);
                            } else if (labelType === 'B') {
                                const result: {
                                    [page: string]: {
                                        x: number;
                                        y: number;
                                        str: string;
                                    }[];
                                } = {};
                                allTextContents.forEach((textContent, index) => {
                                    result[index] = [];
                                    textContent.items.forEach((item) => {
                                        const element = item as TextItem;
                                        if (translations![element.str] !== undefined) {
                                            const x = parseInt(element.transform[4]);
                                            const y = parseInt(element.transform[5]);
                                            result[index].push({
                                                x,
                                                y,
                                                str: translations![element.str],
                                            });
                                        }
                                    });
                                    setDataToUseOnPDfWithTypeB(result);
                                    setCheckedAllPages(true);
                                });
                                console.log(result);
                            }
                        });
                    });
                })
                .catch((err) => {
                    console.log('BLAD');
                    console.log(err);
                });

            // otworzenie pdf do docelowej edycji
            const pdfDoc = await PDFDocument.load(typedarray);
            setPdfToEdit(pdfDoc);
            setShowPdfSpinner(false);
        };

        fileReader.readAsArrayBuffer(file);
    }

    async function createModifiedPdf(event: any): Promise<void> {
        event.preventDefault();
        if (!(pdfToEdit && (dataToUseOnPDfWithTypeA || dataToUseOnPDfWithTypeB))) {
            return;
        }

        const ubuntuFontBytes = await fetch('ubuntu-font.ttf').then((res) => res.arrayBuffer());
        const ubuntuFontBoldBytes = await fetch('ubuntu-bold.ttf').then((res) => res.arrayBuffer());
        pdfToEdit.registerFontkit(fontkit);
        const ubuntuFont = await pdfToEdit.embedFont(ubuntuFontBytes);
        const ubuntuFontBold = await pdfToEdit.embedFont(ubuntuFontBoldBytes);
        const pages = pdfToEdit.getPages();

        if (dataToUseOnPDfWithTypeA && labelType === 'A') {
            let packageNumber = 0;

            pages.forEach((page, pageNumber) => {
                const currentRefExpedition = allRefExpeditions[pageNumber];
                const prevRefExpedition = allRefExpeditions[pageNumber - 1];

                const currentRefArticle = allRefArticles[pageNumber];
                const prevRefArticle = allRefArticles[pageNumber - 1];

                if (currentRefArticle !== prevRefArticle || currentRefExpedition !== prevRefExpedition) {
                    packageNumber += 1;
                }

                page.drawText(dataToUseOnPDfWithTypeA[`${pageNumber}`] || '', {
                    x: 7,
                    y: 132,
                    size: 10,
                    font: ubuntuFont,
                    color: rgb(0, 0, 0),
                    rotate: degrees(0),
                    maxWidth: 350,
                    lineHeight: 12,
                });
                if (carNumber) {
                    let x;
                    if (+carNumber < 10) {
                        x = 537;
                    } else if (+carNumber >= 10 && +carNumber < 100) {
                        x = 530;
                    } else {
                        x = 520;
                    }
                    console.log(x)

                    page.drawText(`${carNumber}`, {
                        x,
                        y: 160,
                        size: 30,
                        font: ubuntuFontBold,
                        color: rgb(0, 0, 0),
                        rotate: degrees(0),
                        maxWidth: 350,
                        lineHeight: 12,
                    });
                }
                page.drawText(`${packageNumber}`, {
                    x: 540,
                    y: 130,
                    size: 25,
                    font: ubuntuFontBold,
                    color: rgb(0, 0, 0),
                    rotate: degrees(0),
                    maxWidth: 350,
                    lineHeight: 12,
                });
            });
        } else if (dataToUseOnPDfWithTypeB && labelType === 'B') {
            pages.forEach((page, pageNumber) => {
                const elements = dataToUseOnPDfWithTypeB[`${pageNumber}`];
                elements.forEach((el) => {
                    page.drawRectangle({
                        x: el.x - 70,
                        y: el.y + 16,
                        width: 275,
                        height: 25,
                        borderWidth: 1,
                        borderColor: rgb(1, 0, 0),
                        color: rgb(1, 1, 1),
                    });
                    page.drawText(el.str || '', {
                        x: el.x - 67,
                        y: el.y + 31,
                        size: 10,
                        font: ubuntuFont,
                        color: rgb(0, 0, 0),
                        rotate: degrees(0),
                        maxWidth: 267,
                        lineHeight: 12,
                    });
                });
            });
        } else {
            return;
        }

        const pdfBytes = await pdfToEdit.save();

        const bytes = new Uint8Array(pdfBytes); // pass your byte response to this constructor
        const blob = new Blob([bytes], { type: 'application/pdf' }); // change resultByte to bytes

        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = 'myFileName.pdf';
        link.click();

        window.location.reload();
    }

    async function parseCsv(e: ChangeEvent<HTMLInputElement>) {
        if (!e.target.files || !/\.csv$/i.test(e.target.files[0].name)) {
            setShowCsvFileError(true);
            return;
        }

        setShowCsvFileError(false);
        const file = e.target.files[0];
        const fileReader = new FileReader();
        fileReader.onload = async function () {
            const csvArray = CSVToArray(fileReader.result?.toString(), ';');
            const formattedCsvArray = getFormatterTranslationsArray(csvArray);
            setTranslations(formattedCsvArray);
        };
        fileReader.readAsText(file, 'windows-1252');
    }

    function shouldDisableGeneratePdfButton() {
        return !(
            checkedAllPages &&
            pdfToEdit !== undefined &&
            (dataToUseOnPDfWithTypeA !== undefined || dataToUseOnPDfWithTypeB !== undefined) &&
            !showPdfFileError &&
            !showCsvFileError &&
            labelType
        );
    }

    return (
        <form className="wrapper" onSubmit={createModifiedPdf}>
            {!labelType && (
                <div className="container">
                    <div className="label-type-title">
                        <div>Wybierz typ etykiet:</div>
                    </div>
                    <div className="mb-5 row">
                        <div className="form-check col">
                            <input
                                className="form-check-input"
                                type="radio"
                                name="inlineRadioOptions"
                                id="inlineRadio1"
                                value="option1"
                                onChange={() => setLabelType('A')}
                            />
                            <label className="form-check-label" htmlFor="inlineRadio1">
                                <img src="images/labels-type-A.png" className="label-type-image" />
                            </label>
                        </div>
                        <div className="form-check col">
                            <input
                                className="form-check-input"
                                type="radio"
                                name="inlineRadioOptions"
                                id="inlineRadio2"
                                value="option2"
                                onChange={() => setLabelType('B')}
                            />
                            <label className="form-check-label" htmlFor="inlineRadio2">
                                <img src="images/labels-type-B.png" className="label-type-image" />
                            </label>
                        </div>
                    </div>
                </div>
            )}

            {labelType && (
                <div className="container">
                    <div className="label-type-title">
                        <div>
                            <span>Wybrany typ etykiet:</span>
                            <span>
                                <button type="button" className="info-button" onClick={() => window.location.reload()}>
                                    (Zmień)
                                </button>
                            </span>
                        </div>
                    </div>
                    <div className="mb-5 center">
                        <img src={`images/labels-type-${labelType}.png`} className="label-type-image" />
                    </div>
                </div>
            )}

            {labelType && (
                <>
                    <div className="mb-5">
                        <label htmlFor="translations-csv" className="form-label">
                            Plik CSV z tłumaczeniami:
                            {translations && !showCsvFileError && <img src="images/check.jpg" className="check-icon" />}
                            <span>
                                <button type="button" className="info-button" data-bs-toggle="modal" data-bs-target="#exampleModal">
                                    (Jak stworzyć plik CSV?)
                                </button>
                            </span>
                            &nbsp;
                        </label>
                        <input type="file" id="translations-csv" className="form-control" onChange={parseCsv} disabled={!labelType} />
                        {showCsvFileError && <div className="error-hint">Wczytaj poprawny plik CSV!</div>}
                    </div>

                    <div className="mb-5">
                        <label htmlFor="labels-pdf" className="form-label">
                            Plik PDF z etykietami:&nbsp;
                            {showPdfSpinner && <span className="hint">wczytywanie pliku...</span>}
                            {pdfToEdit && dataToUseOnPDfWithTypeA && !showPdfSpinner && !showPdfFileError && (
                                <img src="images/check.jpg" className="check-icon" />
                            )}
                        </label>
                        <input type="file" id="labels-pdf" className="form-control" onChange={pdfInputChange} disabled={!translations || !labelType} />
                        {showPdfFileError && <div className="error-hint">Wczytaj poprawny plik PDF z etykietami!</div>}
                        {totalPdfPages && !showPdfFileError && <div>Wczytano plik zawierający {totalPdfPages} stron.</div>}
                    </div>

                    {labelType === 'A' ? (
                        <div className="mb-5">
                            <label htmlFor="labels-pdf" className="form-label">
                                Numer auta:
                            </label>
                            <input
                                type="text"
                                id="car-number"
                                className="form-control"
                                value={carNumber}
                                onChange={({ target }) => setCarNumber(target.value)}
                            />
                        </div>
                    ) : null}

                    <div className="wrapper-center">
                        {shouldDisableGeneratePdfButton() && (
                            <button type="button" className="btn btn-secondary action-button" disabled>
                                Generuj PDF z tłumaczeniami
                            </button>
                        )}
                        {!shouldDisableGeneratePdfButton() && (
                            <button type="submit" className="btn btn-success action-button">
                                Generuj PDF z tłumaczeniami
                            </button>
                        )}
                    </div>
                    <div className="wrapper-center">
                        <div className="label-type-title">
                            <span>
                                <button type="button" className="info-button" onClick={() => window.location.reload()}>
                                    Zresetuj ustawienia
                                </button>
                            </span>
                        </div>
                    </div>
                </>
            )}

            <div className="modal fade" id="exampleModal" tabIndex={-1} aria-labelledby="exampleModalLabel" aria-hidden="true">
                <div className="modal-dialog modal-xl modal-dialog-scrollable">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title" id="exampleModalLabel">
                                Jak zapisać plik CSV?
                            </h5>
                            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div className="modal-body">
                            <p>Wybierz z menu opcję "Zapisz jako", a następnie wybierz format pliku jako CSV rozdzielony przecinkami:</p>
                            <div className="wrapper-center">
                                <img src="images/how-save-csv.jpg" className="info-image" />
                            </div>
                            <p>
                                Czasami może pojawić się dodatkowe okno z informacją o używanych w pliku makrach, formułach itp. Należy potwierdzić, że chcemy
                                zapisać plik:
                            </p>
                            <div className="wrapper-center">
                                <img src="images/confirm-save-csv.jpg" className="info-image" />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">
                                Zamknij
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </form>
    );
}

export default App;
