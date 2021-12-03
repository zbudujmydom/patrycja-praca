import React, { ChangeEvent, useState } from 'react';
import './App.css';
import {getDocument, GlobalWorkerOptions, renderTextLayer } from "pdfjs-dist/legacy/build/pdf.js";
import {  PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import { changeToPolishLetters } from './utils/changeToPolishLetters';
import { CSVToArray } from './utils/csvParser';
import { getFormatterTranslationsArray } from './utils/getFormattedTranslationsArray';
import { TextItem } from 'pdfjs-dist/types/src/display/api';

GlobalWorkerOptions.workerSrc = require("pdfjs-dist/build/pdf.worker.entry.js");

function App() {

  const [translations, setTranslations] = useState<{ [key: string]: string } | null>(null)
  const [checkedAllPages, setCheckedAllPages] = useState<boolean>(false)
  const [dataToUseOnPDf, setDataToUseOnPDf] = useState<{[page: string]: string}>()
  const [pdfToEdit, setPdfToEdit] = useState<PDFDocument>()

  async function pdfInputChange(e: ChangeEvent<HTMLInputElement>) {
    if (!translations) {
      alert('Najpierw wczytaj tlumaczenia!')
    }

    if (!e.target.files) {
      return;
    }

    const file = e.target.files[0]
    if(file.type != "application/pdf"){
      console.error(file.name, "To nie jest plik PDF!")
      return;
    }

    const fileReader = new FileReader();  
    fileReader.onload = async function() {
      const typedarray = new Uint8Array(fileReader.result as any);


      // wczytanie pdf i wyszukanie w tekstach z zapisaniem w tablicy info o id i przypisanym numerze strony i przypisanym tekstem do dodania
      getDocument({data: typedarray}).promise
      .then(pdf => {
        const pages = pdf.numPages;
        const allPromises = []
        for (let i = 1; i <= pages; i++) {
          allPromises.push(pdf.getPage(i))
        }

        Promise.all(allPromises).then(allPages => {
          const allPagesTextContents = []
          for (let j = 0; j < allPages.length; j++) {
            allPagesTextContents.push(allPages[j].getTextContent())
          }

          Promise.all(allPagesTextContents).then(allTextContents => {
            const result: {[page: string]: string} = {};  
            console.log('all contents: ', allTextContents.length)          
            allTextContents.forEach((textContent, index) => {
              textContent.items.forEach((item) => {
                  const str = (item as TextItem).str
                  if (translations![str] !== undefined) {
                    result[index]= translations![str]
                  }
                })
                setDataToUseOnPDf(result)
                setCheckedAllPages(true)
            })
          })
        })
      })
      .catch(err => {
        console.log('BLAD')
        console.log(err)
      })

      
      // otworzenie pdf do docelowej edycji
      const pdfDoc = await PDFDocument.load(typedarray)
      setPdfToEdit(pdfDoc);
    }
    
    fileReader.readAsArrayBuffer(file);
  }
  
  async function createModyfiedPdf(): Promise<void> {
    if (!(pdfToEdit && dataToUseOnPDf)) {
      return;
    }
    
    const helveticaFont = await pdfToEdit.embedFont(StandardFonts.Helvetica)
    const pages = pdfToEdit.getPages()

      pages.forEach((page, pageNumber) => {
        page.drawText(dataToUseOnPDf[`${pageNumber}`] || '', {
          x: 7,
          y: 132,
          size: 10,
          font: helveticaFont,
          color: rgb(0, 0, 0),
          rotate: degrees(0),
          maxWidth: 350,
          lineHeight: 12,
        })
      })
    
      const pdfBytes = await pdfToEdit.save()

      var bytes = new Uint8Array(pdfBytes); // pass your byte response to this constructor
      var blob=new Blob([bytes], {type: "application/pdf"});// change resultByte to bytes

      var link=document.createElement('a');
      link.href=window.URL.createObjectURL(blob);
      link.download="myFileName.pdf";
      link.click();
  }


  async function parseCsv(e: ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) {
      console.log('csv 2 error')
      return;
    }

    const file = e.target.files[0]
    const fileReader = new FileReader();  
    fileReader.onload = async function(result) {
      const csvArray = CSVToArray(fileReader.result?.toString(), ';')
      const formattedCsvArray = getFormatterTranslationsArray(csvArray)
      setTranslations(formattedCsvArray);
    }
    fileReader.readAsText(file, 'windows-1255')
  }

  return (
    <div className="wrapper">
      <div>
        <label htmlFor="translations-csv">Plik CSV z tłumaczeniami:&nbsp;</label>
        <input type="file" id="translations-csv" onChange={parseCsv}/>
        {translations && <img src="images/check.jpg" />}
      </div>
      <br/>
      <div>
        <label htmlFor="labels-pdf">Plik PDF z etykietami:&nbsp;</label>
        <input type="file" id="labels-pdf" onChange={pdfInputChange} disabled={!translations}/>
        {pdfToEdit && dataToUseOnPDf && <img src="images/check.jpg" />}

      </div>
      <br/>
      <button type="button" onClick={createModyfiedPdf} disabled={!(checkedAllPages && pdfToEdit !== undefined && dataToUseOnPDf !== undefined)}>Generuj PDF z tłumaczeniami</button>
    </div>
  );
}

export default App;
